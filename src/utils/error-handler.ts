import { NextFunction, Request, Response } from 'express';

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
 * 애플리케이션 표준 에러 클래스
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly httpCode: number;
  public readonly isOperational: boolean;
  public readonly isRetryable: boolean;
  public readonly originalError?: unknown;
  public readonly context?: Record<string, unknown>;

  constructor(
    type: ErrorType = ErrorType.UNKNOWN,
    message: string = userFriendlyMessages[ErrorType.UNKNOWN],
    isOperational: boolean = true,
    isRetryable: boolean = false,
    originalError?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.httpCode = errorTypeToStatusCode[type];
    this.isOperational = isOperational;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
    this.context = context;
    
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
   * 오류 객체를 JSON으로 변환
   */
  public toJSON(): Record<string, unknown> {
    return {
      success: false,
      error: {
        type: this.type,
        message: this.message,
        httpCode: this.httpCode,
        isRetryable: this.isRetryable,
        context: this.context
      }
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
      } else if (message.includes('not found') || message.includes('404')) {
        errorType = ErrorType.NOT_FOUND;
      } else if (message.includes('translate') || message.includes('google')) {
        errorType = ErrorType.GOOGLE_TRANSLATE;
        isRetryable = true;
      } else if (message.includes('rss') || message.includes('feed') || message.includes('xml')) {
        errorType = ErrorType.RSS_FEED;
        isRetryable = true;
      }
      
      return new AppError(
        errorType,
        error.message,
        true,
        isRetryable,
        error
      );
    }
    
    // 문자열인 경우
    if (typeof error === 'string') {
      return new AppError(
        defaultType,
        error,
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
 * 글로벌 오류 처리 미들웨어
 */
export function globalErrorHandler(
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
    console.error('[심각] 비운영 오류 발생:', err);
  } else {
    console.error(`[오류] ${appError.type}:`, appError.message);
    
    if (appError.originalError) {
      console.error('원본 오류:', appError.originalError);
    }
    
    if (appError.context) {
      console.error('컨텍스트:', appError.context);
    }
  }
  
  // 클라이언트 응답
  res.status(appError.httpCode).json({
    success: false,
    error: {
      type: appError.type,
      message: process.env.NODE_ENV === 'production' 
        ? appError.getUserFriendlyMessage() 
        : appError.message,
      isRetryable: appError.isRetryable
    }
  });
}

/**
 * 비동기 함수 래퍼 (try/catch 자동화)
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
} 