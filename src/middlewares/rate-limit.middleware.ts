import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { AppError, ErrorType } from '../utils/error-handler';
import { serverLogger } from '../utils/logger';

/**
 * 속도 제한 옵션 인터페이스
 */
export interface RateLimitOptions {
  /** 시간 단위당 요청 허용 횟수 (기본값: 60) */
  points: number;
  /** 시간 단위 (초) (기본값: 60) */
  duration: number;
  /** 속도 제한 키 생성 함수 (기본: IP 주소 기반) */
  keyGenerator?: (req: Request) => string;
  /** 차단 시간 (초) (기본값: duration의 2배) */
  blockDuration?: number;
  /** 속도 제한 메시지 */
  message?: string;
  /** 요청 카운트 증가량 (기본값: 1) */
  pointsConsumed?: number;
}

/**
 * 메모리 기반 속도 제한 미들웨어
 * 
 * @param options 속도 제한 옵션
 */
export function rateLimiter(options: Partial<RateLimitOptions> = {}) {
  const {
    points = 60,
    duration = 60,
    blockDuration = duration * 2,
    message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    pointsConsumed = 1
  } = options;
  
  // 기본 키 생성 함수 (IP 주소 기반)
  const defaultKeyGenerator = (req: Request): string => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  };
  
  const keyGenerator = options.keyGenerator || defaultKeyGenerator;
  
  // 메모리 기반 속도 제한기 생성
  const limiter = new RateLimiterMemory({
    points,
    duration,
    blockDuration
  });
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 요청 키 생성
      const key = keyGenerator(req);
      
      // 속도 제한 검사
      await limiter.consume(key, pointsConsumed);
      
      next();
    } catch (error) {
      // 속도 제한 초과 시
      if (error instanceof RateLimiterRes) {
        const retryAfterSeconds = Math.ceil(error.msBeforeNext / 1000);
        
        serverLogger.warn('속도 제한 초과', {
          ip: req.ip,
          path: req.originalUrl,
          method: req.method,
          retryAfter: retryAfterSeconds
        });
        
        // 응답 헤더 설정
        res.set({
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(points),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Date.now() + error.msBeforeNext)
        });
        
        next(new AppError(
          ErrorType.VALIDATION,
          message,
          true,
          true,
          null,
          {
            retryAfter: retryAfterSeconds,
            limit: points
          }
        ));
      } else {
        // 기타 오류
        next(error);
      }
    }
  };
}

/**
 * API 요청 속도 제한 미들웨어 (분당 60회)
 */
export const apiRateLimiter = rateLimiter({
  points: 60,
  duration: 60,
  message: 'API 요청이 너무 많습니다. 분당 최대 60회까지 요청할 수 있습니다.'
});

/**
 * 인증 요청 속도 제한 미들웨어 (분당 10회)
 */
export const authRateLimiter = rateLimiter({
  points: 10,
  duration: 60,
  blockDuration: 300, // 5분 차단
  message: '인증 시도가 너무 많습니다. 5분 후에 다시 시도해주세요.'
});

/**
 * 번역 요청 속도 제한 미들웨어 (분당 30회)
 */
export const translationRateLimiter = rateLimiter({
  points: 30,
  duration: 60,
  message: '번역 요청이 너무 많습니다. 분당 최대 30회까지 요청할 수 있습니다.'
});

/**
 * 사용자 ID 기반 속도 제한 미들웨어
 * 
 * @param options 속도 제한 옵션
 */
export function userRateLimiter(options: Partial<RateLimitOptions> = {}) {
  return rateLimiter({
    ...options,
    keyGenerator: (req: Request) => {
      // 사용자 ID 또는 IP 주소 사용
      const userId = req.user?.id;
      return userId ? `user:${userId}` : `ip:${req.ip}`;
    }
  });
} 