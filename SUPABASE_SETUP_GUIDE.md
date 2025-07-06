# Supabase MCP 연결 설정 가이드

JikSend 백엔드 프로젝트를 Supabase Management Console Platform(MCP)과 연결하기 위한 설정 가이드입니다. 이 문서는 프론트엔드 개발자가 Supabase를 활용하여 백엔드 API와 연동하는 방법을 설명합니다.

## 1. Supabase MCP 개요

Supabase MCP는 PostgreSQL 데이터베이스를 기반으로 하는 클라우드 서비스로, 다음과 같은 기능을 제공합니다:

- **데이터베이스**: PostgreSQL 데이터베이스 호스팅
- **인증**: 사용자 인증 및 권한 관리
- **스토리지**: 파일 저장 및 관리
- **API**: RESTful API 및 실시간 구독
- **Edge Functions**: 서버리스 함수

JikSend는 Supabase를 다음과 같이 활용합니다:
- 데이터 저장 및 관리 (Prisma ORM 사용)
- 일부 인증 기능 (JWT 토큰 관리)
- 파일 스토리지 (뉴스 이미지 등)

## 2. 프론트엔드 개발자를 위한 Supabase 연동 가이드

### 2.1 Supabase 클라이언트 설정

프론트엔드에서 Supabase 클라이언트를 사용하려면 다음과 같이 설정하세요:

```javascript
// supabase-client.js
import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 값 가져오기 (Next.js 예시)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Supabase 클라이언트 생성
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
```

### 2.2 환경 변수 설정 (Next.js)

`.env.local` 파일에 다음 내용을 추가하세요:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# JikSend API 설정
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 2.3 주요 데이터 모델 접근 방법

> ⚠️ **주의**: 가능하면 JikSend API를 통해 데이터에 접근하는 것이 권장됩니다. 다음은 필요한 경우에만 사용하세요.

#### 뉴스 데이터 조회

```javascript
// 최신 뉴스 10개 조회
const { data: news, error } = await supabase
  .from('news')
  .select('id, title, excerpt, category, publishedAt, imageUrl')
  .order('publishedAt', { ascending: false })
  .limit(10);

if (error) {
  console.error('뉴스 조회 오류:', error);
  return;
}

console.log('최신 뉴스:', news);
```

#### 번역 데이터 조회

```javascript
// 특정 텍스트의 번역 캐시 조회
const { data: translations, error } = await supabase
  .from('translations')
  .select('*')
  .eq('originalText', '안녕하세요')
  .eq('targetLang', 'en');
```

## 3. JikSend API와 Supabase 연동 예시

### 3.1 인증 흐름

JikSend는 자체 JWT 인증 시스템을 사용하지만, Supabase Auth와 함께 사용할 수 있습니다:

```javascript
// 1. JikSend API로 로그인
const loginResponse = await fetch('http://localhost:4000/api/v2/users/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { data } = await loginResponse.json();
const { accessToken } = data.tokens;

// 2. 토큰 저장
localStorage.setItem('jiksend_token', accessToken);

// 3. Supabase 세션 설정 (선택적)
// 주의: 이 방법은 Supabase Auth를 사용하는 경우에만 필요합니다
const { user, error } = await supabase.auth.signIn({ 
  email, 
  password 
});
```

### 3.2 뉴스 데이터 조회 및 개인화

```javascript
// 1. JikSend API를 통한 개인화된 뉴스 조회 (권장)
const token = localStorage.getItem('jiksend_token');
const response = await fetch('http://localhost:4000/api/v2/news?personalized=true', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data: personalizedNews } = await response.json();

// 2. Supabase를 통한 직접 조회 (필요한 경우에만)
// 사용자 키워드 조회
const { data: keywords } = await supabase
  .from('keywords')
  .select('keyword')
  .eq('userId', userId);

// 키워드 기반 뉴스 필터링
const keywordList = keywords.map(k => k.keyword);
const { data: filteredNews } = await supabase
  .from('news')
  .select('*')
  .containedBy('keywords', keywordList)
  .order('publishedAt', { ascending: false })
  .limit(20);
```

## 4. 실시간 기능 구현 (선택적)

Supabase는 실시간 구독 기능을 제공합니다. 필요한 경우 다음과 같이 사용할 수 있습니다:

```javascript
// 새로운 뉴스 실시간 구독
const subscription = supabase
  .from('news')
  .on('INSERT', payload => {
    console.log('새 뉴스 추가됨:', payload.new);
    // UI 업데이트 로직
  })
  .subscribe();

// 구독 해제 (컴포넌트 언마운트 시)
const cleanup = () => {
  supabase.removeSubscription(subscription);
};
```

## 5. 파일 스토리지 활용 (이미지 등)

```javascript
// 이미지 업로드
const { data, error } = await supabase.storage
  .from('news-images')
  .upload(`public/${fileName}`, file);

// 이미지 URL 가져오기
const imageUrl = supabase.storage
  .from('news-images')
  .getPublicUrl(`public/${fileName}`).publicURL;
```

## 6. 주의사항 및 모범 사례

1. **API 우선 원칙**: 가능한 한 JikSend API를 통해 데이터에 접근하세요. Supabase 직접 접근은 필요한 경우에만 사용하세요.

2. **권한 관리**: Supabase RLS(Row Level Security)를 이해하고 적절히 활용하세요.

3. **토큰 관리**: JikSend 토큰과 Supabase 토큰을 혼동하지 마세요.

4. **에러 처리**: Supabase 에러와 JikSend API 에러를 모두 적절히 처리하세요.

5. **캐싱 전략**: 중복 요청을 방지하기 위해 적절한 캐싱 전략을 사용하세요.

## 7. 문제 해결

### 일반적인 오류들

**"JWT 만료" 오류**
- JikSend 리프레시 토큰을 사용하여 새 토큰 발급
- 사용자 재로그인 유도

**"권한 없음" 오류**
- Supabase RLS 정책 확인
- 사용자 권한 확인

**"네트워크 오류"**
- API 엔드포인트 URL 확인
- CORS 설정 확인

## 8. 참고 자료

- [Supabase 공식 문서](https://supabase.com/docs)
- [Supabase JavaScript 클라이언트](https://supabase.com/docs/reference/javascript/introduction)
- [Next.js + Supabase 통합 가이드](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
- [Supabase Auth 문서](https://supabase.com/docs/guides/auth)

---

> **중요**: 프론트엔드 코드에서는 항상 ANON_KEY만 사용하세요. SERVICE_ROLE_KEY는 절대 프론트엔드에 노출하지 마세요. 