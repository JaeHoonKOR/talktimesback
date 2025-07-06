# JikSend 백엔드 API

JikSend는 AI 기반 개인화 뉴스 서비스로, Express.js와 TypeScript로 구현된 RESTful API를 제공합니다.

## 목차

- [시작하기](#시작하기)
- [API 엔드포인트](#api-엔드포인트)
- [인증](#인증)
- [Supabase MCP 연동](#supabase-mcp-연동)
- [에러 처리](#에러-처리)
- [Rate Limiting](#rate-limiting)
- [페이지네이션](#페이지네이션)
- [환경 변수](#환경-변수)
- [개발 가이드](#개발-가이드)

## 시작하기

### 요구사항

- Node.js 18.x 이상
- npm 8.x 이상
- PostgreSQL 14.x 이상 (Supabase 제공)

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:4000)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

### API 문서

개발 서버 실행 후 다음 URL에서 Swagger API 문서를 확인할 수 있습니다:
- http://localhost:4000/api-docs

## API 엔드포인트

JikSend API는 v1(레거시)과 v2(RESTful) 버전을 모두 제공합니다. 새로운 개발에는 v2 API를 사용해주세요.

### 주요 API 엔드포인트 (v2)

#### 뉴스 API

| 메서드 | 엔드포인트 | 설명 | 인증 필요 |
|--------|------------|------|-----------|
| GET | `/api/v2/news` | 뉴스 목록 조회 (검색, 필터링, 개인화) | 선택적 |
| GET | `/api/v2/news/:id` | 특정 뉴스 상세 조회 | 아니오 |
| GET | `/api/v2/news/:id/summary` | 뉴스 AI 요약 조회 | 아니오 |
| GET | `/api/v2/news/:id/translations/:lang` | 번역된 뉴스 조회 | 아니오 |
| GET | `/api/v2/news/metadata/sources` | 뉴스 소스 목록 조회 | 아니오 |
| GET | `/api/v2/news/metadata/categories` | 뉴스 카테고리 목록 조회 | 아니오 |
| GET | `/api/v2/news/statistics` | 뉴스 통계 정보 조회 | 아니오 |

#### 번역 API

| 메서드 | 엔드포인트 | 설명 | 인증 필요 |
|--------|------------|------|-----------|
| POST | `/api/v2/translations` | 텍스트 번역 | 예 |
| POST | `/api/v2/translations/batch` | 배치 번역 | 예 |
| POST | `/api/v2/translations/public` | 공개 텍스트 번역 (제한적) | 아니오 |
| GET | `/api/v2/translations/:id` | 특정 번역 조회 | 아니오 |
| GET | `/api/v2/translations` | 번역 히스토리 조회 | 예 |

#### 사용자 API

| 메서드 | 엔드포인트 | 설명 | 인증 필요 |
|--------|------------|------|-----------|
| POST | `/api/v2/users` | 회원가입 | 아니오 |
| POST | `/api/v2/users/sessions` | 로그인 | 아니오 |
| DELETE | `/api/v2/users/sessions` | 로그아웃 | 예 |
| GET | `/api/v2/users/sessions/current` | 현재 세션 정보 조회 | 예 |

#### 헬스체크 API

| 메서드 | 엔드포인트 | 설명 | 인증 필요 |
|--------|------------|------|-----------|
| GET | `/health` | 기본 헬스체크 | 아니오 |
| GET | `/health/db` | 데이터베이스 헬스체크 | 아니오 |

## 인증

JikSend API는 JWT 기반 인증을 사용합니다.

### 인증 흐름

1. `/api/v2/users/sessions` 엔드포인트로 로그인 요청
2. 응답으로 받은 `accessToken`을 Authorization 헤더에 포함하여 요청
   ```
   Authorization: Bearer {accessToken}
   ```
3. 토큰 만료 시 `refreshToken`을 사용하여 새 토큰 발급

### 인증 예시 (JavaScript)

```javascript
// 로그인
const loginResponse = await fetch('http://localhost:4000/api/v2/users/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'password123' })
});

const { data } = await loginResponse.json();
const { accessToken } = data.tokens;

// 인증이 필요한 API 호출
const newsResponse = await fetch('http://localhost:4000/api/v2/news?personalized=true', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

## Supabase MCP 연동

JikSend 백엔드는 Supabase Management Console Platform(MCP)을 사용하여 데이터베이스를 관리합니다.

### Supabase MCP 접속 정보

- **관리자 콘솔**: https://supabase.com/dashboard/project/{PROJECT_ID}
- **API URL**: https://{PROJECT_ID}.supabase.co
- **데이터베이스 URL**: postgresql://postgres:{PASSWORD}@db.{PROJECT_ID}.supabase.co:5432/postgres

### Prisma ORM 연동

JikSend는 Prisma ORM을 사용하여 Supabase 데이터베이스와 연동합니다. 
`.env` 파일에 다음과 같이 설정해주세요:

```
DATABASE_URL="postgresql://postgres:{PASSWORD}@db.{PROJECT_ID}.supabase.co:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres:{PASSWORD}@db.{PROJECT_ID}.supabase.co:5432/postgres?schema=public"
```

### 주요 데이터 모델

JikSend의 주요 데이터 모델은 다음과 같습니다:

- **User**: 사용자 정보
- **News**: 뉴스 정보
- **NewsSummary**: AI 요약 정보
- **Translation**: 번역 캐시
- **Keyword**: 사용자 관심 키워드
- **RefreshToken**: 리프레시 토큰 관리
- **TokenBlacklist**: 무효화된 토큰 관리

## 에러 처리

JikSend API는 표준화된 에러 응답 형식을 제공합니다:

```json
{
  "success": false,
  "error": {
    "type": "ERROR_TYPE",
    "message": "에러 메시지",
    "httpCode": 400,
    "isRetryable": false,
    "errorId": "err_1g9tqz_7f3k2l"
  }
}
```

### 주요 에러 타입

- `VALIDATION`: 입력값 검증 오류
- `AUTHENTICATION`: 인증 오류
- `AUTHORIZATION`: 권한 오류
- `RATE_LIMIT`: 요청 제한 초과
- `NOT_FOUND`: 리소스 없음
- `DATABASE`: 데이터베이스 오류
- `EXTERNAL_API`: 외부 API 오류

## Rate Limiting

모든 API 엔드포인트에는 Rate Limiting이 적용되어 있습니다:

- 기본 API: 분당 60회
- 인증 API: 분당 10회
- 번역 API: 분당 30회
- 뉴스 API: 분당 50회
- 공개 API: 분당 30회

Rate Limit 초과 시 다음과 같은 응답이 반환됩니다 (HTTP 429):

```json
{
  "success": false,
  "error": {
    "type": "RATE_LIMIT",
    "message": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    "httpCode": 429,
    "isRetryable": true,
    "retryAfter": 30,
    "limit": 60
  }
}
```

## 페이지네이션

JikSend API는 두 가지 페이지네이션 방식을 지원합니다:

### 1. 오프셋 기반 페이지네이션 (레거시)

```
GET /api/v2/translations?page=2&limit=20
```

응답:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### 2. 커서 기반 페이지네이션 (권장)

```
GET /api/v2/news?limit=20
GET /api/v2/news?cursor=eyJpZCI6IjEyMyIsInB1Ymxpc2hlZEF0IjoiMjAyNS0wNi0yOFQwMDowMDowMFoifQ==&limit=20
```

응답:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6IjQ1NiIsInB1Ymxpc2hlZEF0IjoiMjAyNS0wNi0yN1QwMDowMDowMFoifQ==",
    "hasNextPage": true,
    "count": 20
  }
}
```

## 환경 변수

JikSend 백엔드는 다음 환경 변수를 사용합니다:

### 필수 환경 변수

- `DATABASE_URL`: Supabase 데이터베이스 URL
- `DIRECT_URL`: Supabase 직접 연결 URL
- `JWT_SECRET`: JWT 토큰 암호화 키
- `JWT_REFRESH_SECRET`: 리프레시 토큰 암호화 키

### 선택적 환경 변수

- `PORT`: 서버 포트 (기본값: 4000)
- `NODE_ENV`: 환경 설정 (development, production)
- `CORS_ORIGIN`: CORS 허용 출처
- `REDIS_URL`: Redis 서버 URL (Rate Limiting 분산 처리용)
- `GOOGLE_TRANSLATE_API_KEY`: Google 번역 API 키
- `OPENAI_API_KEY`: OpenAI API 키 (AI 요약용)

## 개발 가이드

### API 호출 예시 (JavaScript)

#### 뉴스 목록 조회

```javascript
// 기본 뉴스 목록 조회
const response = await fetch('http://localhost:4000/api/v2/news');
const { data } = await response.json();
const { news, pagination } = data;

// 검색 및 필터링
const searchResponse = await fetch('http://localhost:4000/api/v2/news?search=코로나&category=society&sort=latest');
const searchData = await searchResponse.json();

// 커서 기반 페이지네이션
const firstPage = await fetch('http://localhost:4000/api/v2/news?limit=20');
const firstPageData = await firstPage.json();
const { nextCursor } = firstPageData.data.pagination;

const secondPage = await fetch(`http://localhost:4000/api/v2/news?cursor=${nextCursor}&limit=20`);
```

#### 번역 API 사용

```javascript
// 텍스트 번역 (인증 필요)
const translateResponse = await fetch('http://localhost:4000/api/v2/translations', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    text: '안녕하세요',
    targetLang: 'en'
  })
});

const translation = await translateResponse.json();
console.log(translation.data.translatedText); // "Hello"

// 공개 번역 API (인증 불필요, 제한적)
const publicTranslateResponse = await fetch('http://localhost:4000/api/v2/translations/public', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello',
    targetLang: 'ko'
  })
});
```

### 에러 처리 예시

```javascript
try {
  const response = await fetch('http://localhost:4000/api/v2/news/invalid-id');
  const data = await response.json();
  
  if (!data.success) {
    // 에러 처리
    const { type, message, httpCode, isRetryable } = data.error;
    
    switch (type) {
      case 'NOT_FOUND':
        console.error('리소스를 찾을 수 없습니다:', message);
        break;
      case 'RATE_LIMIT':
        const retryAfter = data.error.retryAfter;
        console.error(`요청 제한 초과. ${retryAfter}초 후에 다시 시도하세요.`);
        break;
      default:
        console.error(`오류 발생 (${httpCode}):`, message);
    }
  }
} catch (error) {
  console.error('네트워크 오류:', error);
}
```

### Supabase MCP 직접 접근 (고급)

프론트엔드에서 Supabase 클라이언트를 사용하여 직접 데이터에 접근해야 하는 경우, 다음과 같이 설정할 수 있습니다:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://{PROJECT_ID}.supabase.co';
const supabaseKey = '{ANON_KEY}'; // 공개 anon 키 사용

const supabase = createClient(supabaseUrl, supabaseKey);

// 데이터 조회 예시
const { data, error } = await supabase
  .from('news')
  .select('id, title, excerpt, category')
  .eq('category', 'tech')
  .limit(10);
```

> ⚠️ **주의**: Supabase 직접 접근은 보안 및 데이터 일관성 문제가 발생할 수 있으므로, 가능한 JikSend API를 통해 데이터에 접근하는 것을 권장합니다.

## 추가 문의

API 사용 중 문제가 발생하거나 추가 기능이 필요한 경우 개발팀에 문의해주세요:
- 이메일: support@jiksend.com
- 이슈 트래커: https://github.com/jiksend/backend/issues
