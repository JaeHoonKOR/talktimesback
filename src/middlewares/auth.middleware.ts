import { NextFunction, Request, Response } from 'express';
import { prisma } from '../server';
// 새로운 보안 서비스들 import
import securityLoggerService, { SecurityEventSeverity, SecurityEventType } from '../services/auth/security-logger.service';
import sessionService from '../services/auth/session.service';
import tokenService from '../services/auth/token.service';

// Express의 Request 타입 확장
declare global {
  namespace Express {
    interface User {
      id: number;
      email?: string;
      name?: string;
      kakaoId?: string;
    }
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
        sessionId?: string;
      };
    }
  }
}

/**
 * 사용자 인증 미들웨어 (보안 강화 버전)
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await securityLoggerService.logSecurityEvent(
        SecurityEventType.AUTHENTICATION_FAILED,
        SecurityEventSeverity.MEDIUM,
        'Authorization header missing or invalid',
        null,
        req.ip,
        req.headers['user-agent']
      );
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      // 1. 토큰 블랙리스트 확인
      const isBlacklisted = await tokenService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        await securityLoggerService.logSecurityEvent(
          SecurityEventType.AUTHENTICATION_FAILED,
          SecurityEventSeverity.HIGH,
          'Blacklisted token used',
          null,
          req.ip,
          req.headers['user-agent']
        );
        return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
      }
      
      // 2. 토큰 검증
      const decoded = await tokenService.verifyToken(token);
      
      // 3. 사용자 정보 조회
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });
      
      if (!user) {
        await securityLoggerService.logSecurityEvent(
          SecurityEventType.AUTHENTICATION_FAILED,
          SecurityEventSeverity.HIGH,
          'Token valid but user not found',
          decoded.id,
          req.ip,
          req.headers['user-agent']
        );
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }
      
      // 4. 세션 확인 (세션 ID가 있는 경우)
      const sessionId = decoded.sessionId;
      if (sessionId) {
        const isSessionActive = await sessionService.isSessionActive(sessionId);
        if (!isSessionActive) {
          await securityLoggerService.logSecurityEvent(
            SecurityEventType.SESSION_EXPIRED,
            SecurityEventSeverity.MEDIUM,
            'Session expired or inactive',
            decoded.id,
            req.ip,
            req.headers['user-agent']
          );
          return res.status(401).json({ success: false, message: '세션이 만료되었습니다.' });
        }
        
        // 세션 활동 업데이트
        await sessionService.updateSessionActivity(sessionId);
      }
      
      // 5. 사용자 정보 설정
      req.user = { 
        id: user.id.toString(), 
        email: user.email || '', 
        role: 'user',
        sessionId: sessionId
      };
      
      // 6. 성공 로그
      await securityLoggerService.logSecurityEvent(
        SecurityEventType.AUTHENTICATION_SUCCESS,
        SecurityEventSeverity.LOW,
        'User authenticated successfully',
        decoded.id,
        req.ip,
        req.headers['user-agent']
      );
      
      next();
      
    } catch (jwtError: any) {
      console.error('JWT 검증 오류:', jwtError);
      await securityLoggerService.logSecurityEvent(
        SecurityEventType.AUTHENTICATION_FAILED,
        SecurityEventSeverity.HIGH,
        'JWT verification failed',
        null,
        req.ip,
        req.headers['user-agent'],
        { error: jwtError.message }
      );
      return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }
  } catch (error: any) {
    console.error('인증 미들웨어 오류:', error);
    await securityLoggerService.logSecurityEvent(
      SecurityEventType.SYSTEM_ERROR,
      SecurityEventSeverity.CRITICAL,
      'Authentication middleware error',
      null,
      req.ip,
      req.headers['user-agent'],
      { error: error.message }
    );
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 기존 코드와의 호환성을 위한 alias
export const authenticateToken = authMiddleware;

/**
 * 사용자 역할 열거형
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SYSTEM = 'system'
}

/**
 * 역할 기반 접근 제어 미들웨어 팩토리
 * @param allowedRoles 허용된 역할 배열
 * @returns Express 미들웨어 함수
 */
export function requireAuth(allowedRoles: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // 역할 확인 (관리자는 모든 권한 보유)
      if (allowedRoles.length > 0) {
        const userRole = user.role || 'user';
        
        if (userRole !== 'admin' && !allowedRoles.includes(userRole)) {
          return res.status(403).json({
            success: false,
            message: '접근 권한이 없습니다.',
            code: 'INSUFFICIENT_PERMISSIONS',
            requiredRoles: allowedRoles,
            userRole: userRole
          });
        }
      }

      next();
    } catch (error) {
      console.error('Role-based access control error:', error);
      return res.status(500).json({
        success: false,
        message: '권한 확인 중 오류가 발생했습니다.',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
}

/**
 * 관리자 권한 확인 미들웨어
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireAuth([UserRole.ADMIN])(req, res, next);
}

/**
 * 시스템 권한 확인 미들웨어
 */
export function requireSystem(req: Request, res: Response, next: NextFunction) {
  return requireAuth([UserRole.SYSTEM])(req, res, next);
} 