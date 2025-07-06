import { NextFunction, Request, Response } from 'express';
import { serverLogger } from './logger';

/**
 * 애플리케이션 에러 타입 열거형
 */
export enum ErrorType {
  // 시스템 관련 오류
  SYSTEM = 'SYSTEM',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  
  // 도메인 관련 오류
  TRANSLATION = 'TRANSLATION',
  NEWS = 'NEWS',
  USER = 'USER',
  
  // 외부 서비스 관련 오류
  EXTERNAL_API = 'EXTERNAL_API',
  GOOGLE_TRANSLATE = 'GOOGLE_TRANSLATE',
  RSS_FEED = 'RSS_FEED',
  
  // 기타
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN = 'UNKNOWN'
}

/**
 * HTTP 상태 코드와 에러 타입 매핑
 */
const errorTypeToStatusCode: Record<ErrorType, number> = {
  [ErrorType.SYSTEM]: 500,
  [ErrorType.DATABASE]: 503,
  [ErrorType.NETWORK]: 503,
  [ErrorType.AUTHENTICATION]: 401,
  [ErrorType.AUTHORIZATION]: 403,
  [ErrorType.VALIDATION]: 400,
  [ErrorType.RATE_LIMIT]: 429,
  [ErrorType.TRANSLATION]: 500,
  [ErrorType.NEWS]: 500,
  [ErrorType.USER]: 400,
  [ErrorType.EXTERNAL_API]: 502,
  [ErrorType.GOOGLE_TRANSLATE]: 502,
  [ErrorType.RSS_FEED]: 502,
  [ErrorType.NOT_FOUND]: 404,
  [ErrorType.UNKNOWN]: 500
};

/**
 * 사용자 친화적인 오류 메시지
 */
const userFriendlyMessages: Record<ErrorType, string> = {
  [ErrorType.SYSTEM]: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  [ErrorType.DATABASE]: '데이터베이스 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
  [ErrorType.NETWORK]: '네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
  [ErrorType.AUTHENTICATION]: '로그인이 필요하거나 인증 정보가 유효하지 않습니다.',
  [ErrorType.AUTHORIZATION]: '해당 작업을 수행할 권한이 없습니다.',
  [ErrorType.VALIDATION]: '입력 데이터가 유효하지 않습니다.',
  [ErrorType.RATE_LIMIT]: '요청 횟수가 제한을 초과했습니다. 잠시 후 다시 시도해주세요.',
  [ErrorType.TRANSLATION]: '번역 처리 중 오류가 발생했습니다.',
  [ErrorType.NEWS]: '뉴스 데이터 처리 중 오류가 발생했습니다.',
  [ErrorType.USER]: '사용자 정보 처리 중 오류가 발생했습니다.',
  [ErrorType.EXTERNAL_API]: '외부 서비스 연결에 문제가 발생했습니다.',
  [ErrorType.GOOGLE_TRANSLATE]: '번역 서비스 연결에 문제가 발생했습니다.',
  [ErrorType.RSS_FEED]: '뉴스 피드 수집 중 오류가 발생했습니다.',
  [ErrorType.NOT_FOUND]: '요청한 리소스를 찾을 수 없습니다.',
  [ErrorType.UNKNOWN]: '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
};

/**
 * 민감한 정보를 포함할 수 있는 키워드 목록
 */
const sensitiveKeywords = [
  'password', 'token', 'secret', 'key', 'auth', 'credential', 'pwd', 'pw',
  'apikey', 'api_key', 'access_token', 'refresh_token', 'private', 'cert',
  'encryption', 'hash', 'salt', 'signature', 'jwt', 'bearer'
];

/**
 * 민감한 경로 패턴 목록
 */
const sensitivePathPatterns = [
  /\/home\/\w+\//, // 홈 디렉토리 경로
  /C:\\Users\\[^\\]+\\/, // Windows 사용자 디렉토리
  /\/var\/www\//, // 웹 서버 디렉토리
  /\/app\//, // 컨테이너 앱 디렉토리
  /\\node_modules\\/, // node_modules 경로
  /\/node_modules\//, // node_modules 경로 (Unix)
  /[A-Za-z]:\\Program Files\\/, // Program Files 경로
  /\/etc\//, // 시스템 설정 디렉토리
  /\/tmp\//, // 임시 디렉토리
  /\/usr\//, // 시스템 디렉토리
  /\.env/, // .env 파일
  /config\.json/, // 설정 파일
  /\.pem$/, // 인증서 파일
  /\.key$/ // 키 파일
];

/**
 * 애플리케이션 표준 에러 클래스
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly httpCode: number;
  public readonly isOperational: boolean;
  public readonly isRetryable: boolean;
  public readonly originalError?: unknown;
  public readonly context?: Record<string, unknown>;
  public readonly errorId: string;

  constructor(
    type: ErrorType = ErrorType.UNKNOWN,
    message: string = userFriendlyMessages[ErrorType.UNKNOWN],
    isOperational: boolean = true,
    isRetryable: boolean = false,
    originalError?: unknown,
    context?: Record<string, unknown>
  ) {
    // 메시지에서 민감한 정보 필터링
    const sanitizedMessage = sanitizeErrorMessage(message);
    
    super(sanitizedMessage);
    this.name = this.constructor.name;
    this.type = type;
    this.httpCode = errorTypeToStatusCode[type];
    this.isOperational = isOperational;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
    this.context = sanitizeErrorContext(context);
    
    // 고유한 에러 ID 생성 (추적용)
    this.errorId = generateErrorId();
    
    // 스택 트레이스 캡처 (Node.js에서 Error 객체 확장 시 필요)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 사용자 친화적인 메시지 가져오기
   */
  public getUserFriendlyMessage(): string {
    return userFriendlyMessages[this.type];
  }

  /**
   * 오류 객체를 JSON으로 변환 (클라이언트 응답용)
   */
  public toJSON(includeDetails: boolean = false): Record<string, unknown> {
    const baseError = {
      type: this.type,
      message: includeDetails ? this.message : this.getUserFriendlyMessage(),
      httpCode: this.httpCode,
      isRetryable: this.isRetryable,
      errorId: this.errorId
    };
    
    // 개발 환경이거나 상세 정보 포함 옵션이 켜져 있는 경우에만 추가 정보 포함
    if (includeDetails && process.env.NODE_ENV !== 'production') {
      return {
        success: false,
        error: {
          ...baseError,
          context: this.context
        }
      };
    }
    
    return {
      success: false,
      error: baseError
    };
  }

  /**
   * 외부 오류를 AppError로 변환
   */
  public static fromError(error: unknown, defaultType: ErrorType = ErrorType.UNKNOWN): AppError {
    if (error instanceof AppError) {
      return error;
    }
    
    // 일반 Error 객체인 경우
    if (error instanceof Error) {
      let errorType = defaultType;
      let isRetryable = false;
      
      // 오류 메시지 기반 타입 추론
      const message = error.message.toLowerCase();
      
      if (message.includes('database') || message.includes('prisma') || message.includes('connection')) {
        errorType = ErrorType.DATABASE;
        isRetryable = true;
      } else if (message.includes('network') || message.includes('timeout') || message.includes('econnrefused')) {
        errorType = ErrorType.NETWORK;
        isRetryable = true;
      } else if (message.includes('authentication') || message.includes('unauthorized') || message.includes('token')) {
        errorType = ErrorType.AUTHENTICATION;
      } else if (message.includes('permission') || message.includes('forbidden') || message.includes('access')) {
        errorType = ErrorType.AUTHORIZATION;
      } else if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
        errorType = ErrorType.VALIDATION;
      } else if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
        errorType = ErrorType.RATE_LIMIT;
        isRetryable = true;
      } else if (message.includes('not found') || message.includes('404')) {
        errorType = ErrorType.NOT_FOUND;
      } else if (message.includes('translate') || message.includes('google')) {
        errorType = ErrorType.GOOGLE_TRANSLATE;
        isRetryable = true;
      } else if (message.includes('rss') || message.includes('feed') || message.includes('xml')) {
        errorType = ErrorType.RSS_FEED;
        isRetryable = true;
      }
      
      // 민감한 정보가 포함된 스택 트레이스 정리
      const sanitizedError = new Error(sanitizeErrorMessage(error.message));
      if (error.stack) {
        sanitizedError.stack = sanitizeStackTrace(error.stack);
      }
      
      return new AppError(
        errorType,
        error.message,
        true,
        isRetryable,
        sanitizedError
      );
    }
    
    // 문자열인 경우
    if (typeof error === 'string') {
      return new AppError(
        defaultType,
        sanitizeErrorMessage(error),
        true,
        false
      );
    }
    
    // 그 외 알 수 없는 형태의 오류
    return new AppError(
      ErrorType.UNKNOWN,
      '알 수 없는 오류가 발생했습니다.',
      false,
      false,
      error
    );
  }
}

/**
 * 에러 메시지에서 민감한 정보 제거
 * @param message 원본 에러 메시지
 * @returns 민감한 정보가 제거된 메시지
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return message;
  
  let sanitized = message;
  
  // 민감한 키워드 치환
  sensitiveKeywords.forEach(keyword => {
    const regex = new RegExp(`(${keyword}\\s*[=:]\\s*["']?)[^"'\\s&;)]*["']?`, 'gi');
    sanitized = sanitized.replace(regex, `$1[REDACTED]`);
  });
  
  // 파일 경로 치환
  sensitivePathPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[PATH]/');
  });
  
  // SQL 쿼리 치환
  sanitized = sanitized.replace(/SELECT\s+.*?\s+FROM/gi, 'SELECT [FIELDS] FROM');
  
  // 이메일 주소 마스킹
  sanitized = sanitized.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
  
  // IP 주소 마스킹
  sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
  
  return sanitized;
}

/**
 * 에러 컨텍스트에서 민감한 정보 제거
 * @param context 원본 컨텍스트 객체
 * @returns 민감한 정보가 제거된 컨텍스트 객체
 */
function sanitizeErrorContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return context;
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(context)) {
    // 민감한 키인 경우 값 마스킹
    const isKeywordSensitive = sensitiveKeywords.some(keyword => 
      key.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isKeywordSensitive) {
      sanitized[key] = '[REDACTED]';
    }
    // 객체인 경우 재귀적으로 처리
    else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeErrorContext(value as Record<string, unknown>);
    }
    // 문자열인 경우 민감한 정보 필터링
    else if (typeof value === 'string') {
      sanitized[key] = sanitizeErrorMessage(value);
    }
    // 그 외 경우 그대로 유지
    else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * 스택 트레이스에서 민감한 정보 제거
 * @param stack 원본 스택 트레이스
 * @returns 민감한 정보가 제거된 스택 트레이스
 */
function sanitizeStackTrace(stack: string): string {
  if (!stack) return stack;
  
  let sanitized = stack;
  
  // 파일 경로 치환
  sensitivePathPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[PATH]/');
  });
  
  // 절대 경로를 상대 경로로 변환
  sanitized = sanitized.replace(/(at\s+[\w.<>]+\s+\()([^:)]+)(:\d+:\d+\))/g, (match, prefix, path, suffix) => {
    // src/ 디렉토리 이하만 표시
    const srcIndex = path.indexOf('/src/');
    if (srcIndex !== -1) {
      return `${prefix}${path.substring(srcIndex + 1)}${suffix}`;
    }
    
    // node_modules는 모듈 이름만 표시
    const nodeModulesIndex = path.indexOf('node_modules/');
    if (nodeModulesIndex !== -1) {
      const modulePath = path.substring(nodeModulesIndex + 13);
      const firstSlash = modulePath.indexOf('/');
      if (firstSlash !== -1) {
        const moduleName = modulePath.substring(0, firstSlash);
        return `${prefix}[module:${moduleName}]${suffix}`;
      }
    }
    
    return `${prefix}[path]${suffix}`;
  });
  
  return sanitized;
}

/**
 * 고유한 에러 ID 생성
 * @returns 고유한 에러 ID
 */
function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${randomPart}`;
}

/**
 * 글로벌 오류 처리 미들웨어
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // AppError로 변환
  const appError = err instanceof AppError 
    ? err 
    : AppError.fromError(err);
  
  // 로깅 (운영 환경에서는 비운영 오류만 자세히 로깅)
  if (process.env.NODE_ENV === 'production' && !appError.isOperational) {
    serverLogger.error('[심각] 비운영 오류 발생:', { 
      errorId: appError.errorId,
      type: appError.type,
      message: appError.message,
      path: req.path,
      method: req.method
    });
  } else {
    const logLevel = appError.type === ErrorType.RATE_LIMIT ? 'warn' : 'error';
    serverLogger[logLevel](`[오류] ${appError.type}:`, { 
      errorId: appError.errorId,
      message: appError.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    });
    
    if (appError.originalError && process.env.NODE_ENV !== 'production') {
      serverLogger.debug('원본 오류:', { originalError: appError.originalError });
    }
    
    if (appError.context) {
      serverLogger.debug('컨텍스트:', { context: appError.context });
    }
  }
  
  // 클라이언트 응답 준비
  const includeDetails = process.env.NODE_ENV !== 'production';
  const responseBody = appError.toJSON(includeDetails);
  
  // Rate Limit 오류인 경우 추가 정보 제공
  if (appError.type === ErrorType.RATE_LIMIT && appError.context) {
    responseBody.error = {
      ...responseBody.error,
      retryAfter: appError.context.retryAfter,
      limit: appError.context.limit
    };
  }
  
  // 응답 전송
  if (!res.headersSent) {
    res.status(appError.httpCode).json(responseBody);
  }
}

/**
 * 비동기 함수 래퍼 (try/catch 자동화)
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
} 