# 트러블슈팅 로그

## 백엔드 API 표준화 및 개선 작업

### Metadata
- **Timestamp**: 2024-12-27 15:30:00 (KST)
- **Severity**: Medium
- **Impacted Systems**: Express.js Backend API, 뉴스 서비스, 번역 서비스
- **Tags**: API 표준화, RESTful API, 입력 검증, Swagger 문서화, 타입 정의

### Problem Summary
JikSend 백엔드 API의 일관성 부족 및 표준화 필요성이 제기되었습니다. RESTful API 설계 원칙 미준수, 입력 검증 미들웨어 부재, API 문서화 부족 등의 문제가 있었습니다.

### Root Cause
1. **RESTful API 설계 미준수**: POST 메서드로 검색 기능 구현 (GET으로 변경 필요)
2. **입력 검증 부족**: express-validator 미도입으로 인한 체계적인 검증 규칙 부재
3. **응답 형식 불일치**: 각 엔드포인트마다 다른 응답 구조 사용
4. **API 문서화 부족**: Swagger/OpenAPI 문서 부재로 인한 개발자 경험 저하
5. **타입 정의 불완전**: 요청/응답 타입 정의 및 인터페이스 미흡

### Resolution Steps
1. **응답 형식 표준화 구현**
   - `jiksend-backend/src/types/api.types.ts` 생성
   - ApiResponse, ApiError, PaginationMeta 인터페이스 정의
   - ErrorCode 열거형 및 HTTP 상태 코드 매핑
   - `jiksend-backend/src/utils/response.helper.ts` 생성으로 ResponseHelper 클래스 구현

2. **입력 검증 미들웨어 도입**
   - express-validator 패키지 설치
   - `jiksend-backend/src/middlewares/validation.middleware.ts` 생성
   - ValidationRules, NewsValidation, TranslationValidation 클래스 구현
   - 체계적인 검증 규칙 및 createValidationMiddleware 헬퍼 함수 제공

3. **RESTful API 표준화**
   - 뉴스 라우트 개선: RESTful URL 구조 적용
   - 번역 라우트 개선: 공개/인증 엔드포인트 분리
   - 헬스체크 라우트 표준화된 응답 형식 적용
   - 컨트롤러 개선: ResponseHelper 사용 및 페이지네이션 지원 강화

4. **API 문서화 (Swagger/OpenAPI)**
   - swagger-jsdoc, swagger-ui-express 패키지 설치
   - `jiksend-backend/src/config/swagger.ts` 생성
   - OpenAPI 3.0 스펙 정의 및 스키마 구성
   - 개발 환경에서 `/api-docs` 엔드포인트 제공

5. **타입 정의 완성**
   - 뉴스, 번역, 사용자 관련 타입 정의
   - 요청/응답 인터페이스 개선
   - 에러 처리 타입 정의

### Error Message / Logs
```
이전 API 응답 형식:
{
  "success": true,
  "data": [...]
}

표준화된 API 응답 형식:
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2024-12-27T15:30:00.000Z"
}
```

### Related Commits or Pull Requests
- 응답 형식 표준화: `api.types.ts`, `response.helper.ts` 생성
- 입력 검증 미들웨어: `validation.middleware.ts` 생성
- RESTful API 표준화: 라우트 및 컨트롤러 개선
- Swagger 문서화: `swagger.ts` 설정 및 서버 연동

### Reproduction Steps
1. 기존 API 엔드포인트 호출 시 일관성 없는 응답 형식 확인
2. 입력 검증 없이 잘못된 데이터 전송 시 적절한 에러 처리 부재
3. POST `/api/news/search` 엔드포인트의 RESTful 설계 원칙 위반
4. API 문서 부재로 인한 개발자 경험 저하

### Prevention / Lessons Learned
1. **API 설계 단계에서 RESTful 원칙 준수**: HTTP 메서드와 URL 설계 가이드라인 적용
2. **입력 검증 미들웨어 필수 적용**: 모든 API 엔드포인트에 적절한 검증 규칙 적용
3. **응답 형식 표준화**: 일관된 API 응답 구조로 클라이언트 개발 편의성 향상
4. **API 문서화 자동화**: Swagger/OpenAPI를 통한 실시간 문서 업데이트
5. **타입 정의 우선**: TypeScript 타입 정의를 통한 컴파일 타임 오류 방지

### Related Links
- [RESTful API 설계 가이드](https://restfulapi.net/)
- [express-validator 문서](https://express-validator.github.io/docs/)
- [Swagger/OpenAPI 스펙](https://swagger.io/specification/)
- [TypeScript 타입 정의 가이드](https://www.typescriptlang.org/docs/)

## 백엔드 코드 보안 이슈 검토

### Metadata
- **Timestamp**: 2024-12-31 09:00:00 (KST)
- **Severity**: High
- **Impacted Systems**: 전체 백엔드 시스템
- **Tags**: 보안, 인증, 프로덕션 준비

### Problem Summary
백엔드 코드에서 여러 보안 취약점이 발견되었습니다.

### Root Cause
- JWT 시크릿 키 하드코딩 및 기본값 사용
- 비밀번호 해시 검증 로직 부족
- 인증 미들웨어의 불충분한 토큰 검증
- 환경 변수 관리 부실

### Resolution Steps
1. JWT 시크릿 키 강화 및 환경 변수 검증 추가
2. 비밀번호 해시 알고리즘 최신화
3. 인증 미들웨어 토큰 검증 로직 개선
4. 환경 변수 필수 값 검증 로직 추가

### Error Message / Logs
- JWT_SECRET 기본값 사용: "your-jwt-secret-key"
- 환경 변수 검증 부재

### Related Commits or Pull Requests
- 해당 없음 (신규 이슈)

### Prevention / Lessons Learned
- 환경 변수 검증 로직을 서버 시작 시 실행
- 보안 관련 환경 변수는 기본값 제공하지 않기
- 정기적인 보안 코드 리뷰 실시

### Related Links
- [OWASP JWT 보안 가이드](https://owasp.org/www-project-web-security-testing-guide/)

---

## RESTful API 구조 개선 검토

### Metadata
- **Timestamp**: 2024-12-31 10:00:00 (KST)
- **Severity**: Medium
- **Impacted Systems**: API 엔드포인트 전체
- **Tags**: API 설계, RESTful, 아키텍처

### Problem Summary
현재 API 구조가 RESTful 원칙을 완전히 준수하지 않고 있습니다.

### Root Cause
- 동사 기반 엔드포인트 사용 (RPC 스타일)
- 비표준 검색 및 필터링 엔드포인트
- 중첩된 공개/비공개 API 구조
- 일관성 없는 HTTP 메서드 사용

### Resolution Steps
1. v2 API 라우터 설계 및 구현
2. 리소스 기반 URL 구조로 재설계
3. 쿼리 파라미터를 활용한 필터링 개선
4. 표준 HTTP 메서드 사용 강화

### Error Message / Logs
- 비표준 엔드포인트: POST /api/news/fetch, POST /api/translation/text
- 중첩 구조: POST /api/translation/public/text

### Related Commits or Pull Requests
- 해당 없음 (신규 이슈)

### Prevention / Lessons Learned
- API 설계 시 RESTful 원칙 준수 필수
- 정기적인 API 아키텍처 리뷰 실시
- 팀 내 RESTful 가이드라인 수립

### Related Links
- [RESTful API 설계 가이드](https://restfulapi.net/)
- [HTTP 메서드 사용 가이드](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)

---

## RESTful API v2 구현 완료

### Metadata
- **Timestamp**: 2024-12-31 11:00:00 (KST)
- **Severity**: Low
- **Impacted Systems**: API 엔드포인트 전체
- **Tags**: API 개선, RESTful, 완료

### Problem Summary
RESTful API v2 구현 및 기존 API deprecated 처리가 완료되었습니다.

### Root Cause
- 기존 API 구조 개선 필요에 따른 계획적 마이그레이션

### Resolution Steps
1. ✅ 기존 API에 deprecated 경고 헤더 추가
2. ✅ v2 API 라우터 구현 (news, translations, users)
3. ✅ v2 전용 컨트롤러 함수 구현
4. ✅ 서버에 v2 API 연결
5. ✅ Swagger 문서 업데이트 시작

### Error Message / Logs
- 성공적으로 v2 API 구현 완료
- 모든 deprecated 경고 헤더 적용됨

### Related Commits or Pull Requests
- 해당 없음 (신규 구현)

### Prevention / Lessons Learned
- 점진적 API 마이그레이션 전략 효과적
- deprecated 경고를 통한 사용자 안내 중요
- 버전 관리 시스템 구축 필요

### Related Links
- [API 버전 관리 가이드](https://restfulapi.net/versioning/)
- [Deprecated API 관리 방법](https://swagger.io/specification/)

## 2025-01-28 10:30:00 - JWT_SECRET 자동 생성 기능 구현

### Metadata
- **Timestamp**: 2025-01-28 10:30:00 (KST)
- **Severity**: Medium
- **Impacted Systems**: 인증 시스템, 환경 변수 관리
- **Tags**: security, jwt, automation, environment-setup

### Problem Summary
JWT_SECRET 환경 변수를 수동으로 설정해야 하는 번거로움과 개발자가 약한 시크릿 키를 사용할 가능성을 해결하기 위한 자동 생성 시스템 구현

### Root Cause
기존 시스템에서는 JWT_SECRET을 개발자가 수동으로 생성하여 .env 파일에 설정해야 했으며, 이로 인해 다음과 같은 문제점이 발생했습니다:
1. 개발자가 약한 시크릿 키를 사용할 가능성
2. 시크릿 키 설정을 잊어버리는 경우
3. 프로덕션 환경에서 기본값 사용 위험

### Resolution Steps
1. **jwt-secret-generator.ts 유틸리티 생성**
   - crypto.randomBytes()를 사용한 강력한 랜덤 키 생성
   - .env 파일 자동 읽기/쓰기 기능
   - 기존 키 검증 및 업데이트 로직

2. **env-validator.ts 수정**
   - 환경 변수 검증 시점에 자동 생성 로직 추가
   - JWT_SECRET과 NEXTAUTH_SECRET 자동 확인/생성

3. **generate-jwt-secret.ts CLI 도구 생성**
   - 개발자가 수동으로 시크릿 키 생성할 수 있는 옵션 제공
   - 다양한 사용 옵션 지원 (길이 설정, 자동 설정 등)

4. **package.json 스크립트 추가**
   - `npm run generate-jwt-secret`: 기본 JWT 시크릿 생성
   - `npm run setup-secrets`: 모든 보안 키 자동 설정

### Generated Files
- `src/utils/jwt-secret-generator.ts`: 핵심 유틸리티
- `src/scripts/generate-jwt-secret.ts`: CLI 도구
- 기존 파일 수정: `src/utils/env-validator.ts`, `package.json`

### Usage Examples
```bash
# 기본 64자 시크릿 생성 및 .env 저장
npm run generate-jwt-secret

# 128자 시크릿 생성
npm run generate-jwt-secret -- --length 128

# 모든 보안 키 자동 설정
npm run setup-secrets

# 시크릿만 생성 (저장하지 않음)
npm run generate-jwt-secret -- --generate-only
```

### Security Features
- 최소 32자 이상의 강력한 랜덤 키 생성
- 기존 약한 키 자동 교체
- 환경 변수와 파일 동시 지원
- 민감 정보 로그 마스킹

### Prevention / Lessons Learned
1. 보안 관련 환경 변수는 자동 생성 메커니즘을 제공하여 사용자 실수 방지
2. CLI 도구를 통해 개발자 경험 개선
3. 서버 시작 시점에 자동 검증하여 프로덕션 환경에서의 보안 강화

### Related Links
- JWT 보안 모범사례: https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/
- Node.js crypto 모듈: https://nodejs.org/api/crypto.html

--- 