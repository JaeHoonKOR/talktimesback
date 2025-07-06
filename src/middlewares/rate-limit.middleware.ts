import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { IRateLimiterOptions, RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
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
  /** 관리자 예외 처리 여부 (기본값: true) */
  skipAdmin?: boolean;
  /** 예외 경로 패턴 목록 */
  skipPaths?: RegExp[];
}

// Redis 클라이언트 (환경 변수에 설정된 경우에만 사용)
let redisClient: Redis | null = null;

// Redis 연결 설정
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
    });
    
    redisClient.on('error', (err) => {
      serverLogger.error('Redis 연결 오류', err);
    });
    
    redisClient.on('connect', () => {
      serverLogger.info('Redis 연결 성공 - Rate Limiter에서 Redis 사용');
    });
  } catch (err) {
    serverLogger.error('Redis 클라이언트 생성 실패', err);
    redisClient = null;
  }
}

/**
 * 속도 제한기 생성 함수
 * Redis가 사용 가능하면 Redis 기반, 아니면 메모리 기반 제한기 생성
 * 
 * @param options 속도 제한기 옵션
 * @returns 속도 제한기 인스턴스
 */
function createLimiter(options: IRateLimiterOptions) {
  if (redisClient) {
    return new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'ratelimit',
      ...options,
    });
  } else {
    return new RateLimiterMemory(options);
  }
}

/**
 * 속도 제한 미들웨어 팩토리 함수
 * 
 * @param options 속도 제한 옵션
 */
export function rateLimiter(options: Partial<RateLimitOptions> = {}) {
  const {
    points = 60,
    duration = 60,
    blockDuration = duration * 2,
    message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    pointsConsumed = 1,
    skipAdmin = true,
    skipPaths = [/^\/health/, /^\/metrics/]
  } = options;
  
  // 기본 키 생성 함수 (IP 주소 기반)
  const defaultKeyGenerator = (req: Request): string => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  };
  
  const keyGenerator = options.keyGenerator || defaultKeyGenerator;
  
  // 속도 제한기 생성
  const limiter = createLimiter({
    points,
    duration,
    blockDuration
  });
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 예외 경로 확인
      for (const pattern of skipPaths) {
        if (pattern.test(req.path)) {
          return next();
        }
      }
      
      // 관리자 예외 처리
      if (skipAdmin && req.user?.role === 'admin') {
        return next();
      }
      
      // 요청 키 생성
      const key = keyGenerator(req);
      
      // 속도 제한 검사
      const result = await limiter.consume(key, pointsConsumed);
      
      // 응답 헤더 설정 (제한 정보 포함)
      res.set({
        'X-RateLimit-Limit': String(points),
        'X-RateLimit-Remaining': String(Math.max(0, result.remainingPoints)),
        'X-RateLimit-Reset': String(Date.now() + result.msBeforeNext)
      });
      
      next();
    } catch (error) {
      // 속도 제한 초과 시
      if (error instanceof RateLimiterRes) {
        const retryAfterSeconds = Math.ceil(error.msBeforeNext / 1000);
        
        serverLogger.warn('속도 제한 초과', {
          ip: req.ip,
          path: req.originalUrl,
          method: req.method,
          retryAfter: retryAfterSeconds,
          user: req.user?.id || 'anonymous'
        });
        
        // 응답 헤더 설정
        res.set({
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(points),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Date.now() + error.msBeforeNext)
        });
        
        // 429 상태 코드로 응답
        res.status(429);
        
        next(new AppError(
          ErrorType.RATE_LIMIT,
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
 * IP 및 사용자 ID 기반 이중 속도 제한 미들웨어
 * 
 * @param options 속도 제한 옵션
 */
export function dualRateLimiter(options: Partial<RateLimitOptions> = {}) {
  const ipLimiter = rateLimiter({
    ...options,
    points: options.points || 100, // IP 기반은 더 높은 제한
    keyGenerator: (req: Request) => `ip:${req.ip || 'unknown'}`
  });
  
  const userLimiter = rateLimiter({
    ...options,
    points: options.points || 60, // 사용자 기반은 더 낮은 제한
    keyGenerator: (req: Request) => {
      const userId = req.user?.id;
      return userId ? `user:${userId}` : `session:${req.sessionID || req.ip}`;
    },
    skipPaths: [...(options.skipPaths || []), /^\/auth\/login/, /^\/auth\/register/]
  });
  
  return (req: Request, res: Response, next: NextFunction) => {
    // 먼저 IP 기반 제한 적용
    ipLimiter(req, res, (err) => {
      if (err) {
        return next(err);
      }
      
      // 다음으로 사용자 기반 제한 적용 (인증된 요청만)
      if (req.user) {
        userLimiter(req, res, next);
      } else {
        next();
      }
    });
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
  message: '인증 시도가 너무 많습니다. 5분 후에 다시 시도해주세요.',
  skipAdmin: false // 관리자도 인증 제한 적용
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
 * 뉴스 API 속도 제한 미들웨어 (분당 50회)
 */
export const newsRateLimiter = rateLimiter({
  points: 50,
  duration: 60,
  message: '뉴스 API 요청이 너무 많습니다. 분당 최대 50회까지 요청할 수 있습니다.'
});

/**
 * 공개 API 속도 제한 미들웨어 (분당 30회)
 */
export const publicApiRateLimiter = rateLimiter({
  points: 30,
  duration: 60,
  message: '공개 API 요청이 너무 많습니다. 분당 최대 30회까지 요청할 수 있습니다.',
  skipAdmin: false // 공개 API는 관리자도 제한 적용
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

/**
 * 엔드포인트별 속도 제한 미들웨어
 * 특정 엔드포인트에 대한 맞춤형 속도 제한 설정
 * 
 * @param endpoint 엔드포인트 경로
 * @param options 속도 제한 옵션
 */
export function endpointRateLimiter(endpoint: string, options: Partial<RateLimitOptions> = {}) {
  const limiter = rateLimiter(options);
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === endpoint || req.path.startsWith(`${endpoint}/`)) {
      limiter(req, res, next);
    } else {
      next();
    }
  };
} 