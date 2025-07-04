/**
 * 표준화된 API 응답 타입 정의
 */

// 기본 API 응답 인터페이스
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: PaginationMeta;
  timestamp: string;
}

// 에러 응답 인터페이스
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  field?: string; // 필드별 검증 오류용
}

// 페이지네이션 메타데이터
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 페이지네이션 요청 파라미터
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// 정렬 파라미터
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 필터링 파라미터
export interface FilterParams {
  search?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

// 뉴스 관련 타입
export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceId: string;
  category: string;
  publishedAt: string;
  excerpt: string;
  content?: string;
  imageUrl?: string;
  isProcessed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewsListResponse {
  items: NewsItem[];
  pagination: PaginationMeta;
}

export interface NewsSearchParams extends PaginationParams, SortParams, FilterParams {
  keywords?: string[];
  sources?: string[];
  categories?: string[];
}

// 번역 관련 타입
export interface TranslationRequest {
  text: string;
  targetLang: string;
  sourceLang?: string;
}

export interface TranslationResponse {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  cached: boolean;
}

export interface BatchTranslationRequest {
  texts: string[];
  targetLang: string;
  sourceLang?: string;
}

export interface BatchTranslationResponse {
  translations: TranslationResponse[];
  totalCount: number;
  successCount: number;
  failureCount: number;
}

// 사용자 관련 타입
export interface UserProfile {
  id: number;
  email?: string;
  name?: string;
  language: string;
  preferredTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  enableNotification: boolean;
  contentLength: 'short' | 'medium' | 'long';
  includeImages: boolean;
  includeVideos: boolean;
}

// 키워드 관련 타입
export interface Keyword {
  id: number;
  keyword: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeywordRequest {
  keyword: string;
  category?: string;
}

// 헬스체크 관련 타입
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version?: string;
  checks: {
    database: HealthCheckStatus;
    externalServices?: HealthCheckStatus;
  };
}

export interface HealthCheckStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  message?: string;
  details?: any;
}

// 통계 관련 타입
export interface NewsStats {
  totalNews: number;
  totalSources: number;
  newsTodayCount: number;
  newsWeekCount: number;
  categoriesCount: Record<string, number>;
  sourcesCount: Record<string, number>;
}

// 에러 코드 열거형
export enum ErrorCode {
  // 일반 오류
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  
  // 인증/권한 오류
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // 검증 오류
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // 리소스 오류
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // 외부 서비스 오류
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSLATION_SERVICE_ERROR = 'TRANSLATION_SERVICE_ERROR',
  
  // 비즈니스 로직 오류
  INVALID_OPERATION = 'INVALID_OPERATION',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

// HTTP 상태 코드 매핑
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.UNKNOWN_ERROR]: 500,
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.DATABASE_ERROR]: 503,
  [ErrorCode.TRANSLATION_SERVICE_ERROR]: 502,
  [ErrorCode.INVALID_OPERATION]: 400,
  [ErrorCode.QUOTA_EXCEEDED]: 429,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429
}; 