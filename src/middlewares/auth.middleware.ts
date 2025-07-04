import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';
import { AppError, ErrorType } from '../utils/error-handler';
import { authLogger } from '../utils/logger';

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
        role: string;
      };
    }
  }
}

/**
 * 사용자 인증 미들웨어
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'your_jwt_secret_should_be_long_and_secure';
    
    try {
      const decoded = jwt.verify(token, secret) as { id: number, email: string };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });
      
      if (!user) {
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }
      
      req.user = { id: user.id, email: user.email || undefined, name: user.name || undefined };
      next();
    } catch (jwtError) {
      console.error('JWT 검증 오류:', jwtError);
      return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }
  } catch (error) {
    console.error('인증 미들웨어 오류:', error);
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
 * 사용자 정보 타입 정의
 * (req.user에 추가됨)
 */
export interface User {
  id: string;
  email: string;
  roles: UserRole[];
  isAuthenticated: boolean;
}

/**
 * 요청 객체 확장 (TypeScript 타입 확장)
 */
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * 인증 필요 미들웨어
 * 요청의 사용자가 인증되었는지 확인
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isAuthenticated) {
    authLogger.warn('인증되지 않은 사용자의 접근 시도', {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    
    return next(new AppError(
      ErrorType.AUTHENTICATION,
      '이 작업을 수행하려면 로그인이 필요합니다.',
      true,
      false,
      null,
      { path: req.originalUrl }
    ));
  }
  
  authLogger.debug('인증된 사용자 접근', {
    userId: req.user.id,
    path: req.originalUrl
  });
  
  next();
}

/**
 * 역할 확인 미들웨어
 * 사용자가 특정 역할을 가지고 있는지 확인
 * 
 * @param requiredRole 요구되는 역할
 */
export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 인증 확인
    if (!req.user || !req.user.isAuthenticated) {
      authLogger.warn('인증되지 않은 사용자의 역할 접근 시도', {
        requiredRole,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip
      });
      
      return next(new AppError(
        ErrorType.AUTHENTICATION,
        '이 작업을 수행하려면 로그인이 필요합니다.',
        true,
        false,
        null,
        { requiredRole, path: req.originalUrl }
      ));
    }
    
    // 역할 확인
    if (!req.user.roles.includes(requiredRole)) {
      authLogger.warn('권한 없는 사용자의 접근 시도', {
        userId: req.user.id,
        userRoles: req.user.roles,
        requiredRole,
        path: req.originalUrl,
        method: req.method
      });
      
      return next(new AppError(
        ErrorType.AUTHORIZATION,
        '이 작업을 수행할 권한이 없습니다.',
        true,
        false,
        null,
        { requiredRole, userRoles: req.user.roles, path: req.originalUrl }
      ));
    }
    
    authLogger.debug('권한 확인 성공', {
      userId: req.user.id,
      roles: req.user.roles,
      requiredRole,
      path: req.originalUrl
    });
    
    next();
  };
}

/**
 * 여러 역할 중 하나라도 가지고 있는지 확인하는 미들웨어
 * 
 * @param roles 요구되는 역할 배열 (하나라도 가지고 있으면 통과)
 */
export function requireAnyRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 인증 확인
    if (!req.user || !req.user.isAuthenticated) {
      return next(new AppError(
        ErrorType.AUTHENTICATION,
        '이 작업을 수행하려면 로그인이 필요합니다.',
        true,
        false,
        null,
        { requiredRoles: roles, path: req.originalUrl }
      ));
    }
    
    // 역할 확인 (하나라도 일치하면 통과)
    const hasRequiredRole = req.user.roles.some(role => roles.includes(role));
    
    if (!hasRequiredRole) {
      authLogger.warn('권한 없는 사용자의 접근 시도', {
        userId: req.user.id,
        userRoles: req.user.roles,
        requiredRoles: roles,
        path: req.originalUrl,
        method: req.method
      });
      
      return next(new AppError(
        ErrorType.AUTHORIZATION,
        '이 작업을 수행할 권한이 없습니다.',
        true,
        false,
        null,
        { requiredRoles: roles, userRoles: req.user.roles }
      ));
    }
    
    next();
  };
}

/**
 * 모든 역할을 가지고 있는지 확인하는 미들웨어
 * 
 * @param roles 요구되는 역할 배열 (모두 가지고 있어야 통과)
 */
export function requireAllRoles(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 인증 확인
    if (!req.user || !req.user.isAuthenticated) {
      return next(new AppError(
        ErrorType.AUTHENTICATION,
        '이 작업을 수행하려면 로그인이 필요합니다.',
        true,
        false,
        null,
        { requiredRoles: roles, path: req.originalUrl }
      ));
    }
    
    // 역할 확인 (모든 역할을 가지고 있어야 통과)
    const hasAllRequiredRoles = roles.every(role => req.user!.roles.includes(role));
    
    if (!hasAllRequiredRoles) {
      authLogger.warn('권한 없는 사용자의 접근 시도', {
        userId: req.user.id,
        userRoles: req.user.roles,
        requiredRoles: roles,
        path: req.originalUrl,
        method: req.method
      });
      
      return next(new AppError(
        ErrorType.AUTHORIZATION,
        '이 작업을 수행할 권한이 없습니다.',
        true,
        false,
        null,
        { requiredRoles: roles, userRoles: req.user.roles }
      ));
    }
    
    next();
  };
}

/**
 * 관리자 권한 확인 미들웨어 (간편 사용용)
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(UserRole.ADMIN)(req, res, next);
}

/**
 * 시스템 권한 확인 미들웨어 (간편 사용용)
 */
export function requireSystem(req: Request, res: Response, next: NextFunction) {
  return requireRole(UserRole.SYSTEM)(req, res, next);
} 