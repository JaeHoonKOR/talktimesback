import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { LoginDto, SignUpDto } from '../types/auth.types';
// 새로운 보안 서비스들 import
import securityLoggerService, { SecurityEventSeverity, SecurityEventType } from '../services/auth/security-logger.service';
import sessionService from '../services/auth/session.service';
import tokenService from '../services/auth/token.service';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!; // 환경 변수 검증으로 존재 보장됨

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, name }: SignUpDto = req.body;

    // 이메일 중복 체크
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      await securityLoggerService.logSecurityEvent(
        SecurityEventType.REGISTRATION_FAILED,
        SecurityEventSeverity.MEDIUM,
        'Duplicate email registration attempt',
        null,
        req.ip,
        req.headers['user-agent'],
        { email }
      );
      return res.status(400).json({ message: '이미 존재하는 이메일입니다.' });
    }

    // 비밀번호 해싱 (보안 강화를 위해 12 라운드 사용)
    const hashedPassword = await bcrypt.hash(password, 12);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    });

    // 세션 생성
    const sessionId = await sessionService.createSession(user.id.toString(), req);

    // JWT 토큰 생성 (세션 ID 포함)
    const accessToken = await tokenService.generateAccessToken(user.id.toString(), user.email || '', sessionId);
    const refreshToken = await tokenService.generateRefreshToken(user.id.toString(), sessionId);

    // 성공 로그
    await securityLoggerService.logSecurityEvent(
      SecurityEventType.REGISTRATION_SUCCESS,
      SecurityEventSeverity.LOW,
      'User registered successfully',
      user.id.toString(),
      req.ip,
      req.headers['user-agent']
    );

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error: any) {
    console.error('회원가입 에러:', error);
    await securityLoggerService.logSecurityEvent(
      SecurityEventType.SYSTEM_ERROR,
      SecurityEventSeverity.CRITICAL,
      'Registration system error',
      null,
      req.ip,
      req.headers['user-agent'],
      { error: error?.message || 'Unknown error' }
    );
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginDto = req.body;

    // 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      await securityLoggerService.logSecurityEvent(
        SecurityEventType.LOGIN_FAILED,
        SecurityEventSeverity.MEDIUM,
        'Login attempt with non-existent email',
        null,
        req.ip,
        req.headers['user-agent'],
        { email }
      );
      return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    // 비밀번호 확인
    if (!user.password) {
      await securityLoggerService.logSecurityEvent(
        SecurityEventType.LOGIN_FAILED,
        SecurityEventSeverity.HIGH,
        'Login attempt for user without password',
        user.id.toString(),
        req.ip,
        req.headers['user-agent']
      );
      return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await securityLoggerService.logSecurityEvent(
        SecurityEventType.LOGIN_FAILED,
        SecurityEventSeverity.HIGH,
        'Login attempt with wrong password',
        user.id.toString(),
        req.ip,
        req.headers['user-agent']
      );
      return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    // 세션 생성
    const sessionId = await sessionService.createSession(user.id.toString(), req);

    // JWT 토큰 생성 (세션 ID 포함)
    const accessToken = await tokenService.generateAccessToken(user.id.toString(), user.email || '', sessionId);
    const refreshToken = await tokenService.generateRefreshToken(user.id.toString(), sessionId);

    // 성공 로그
    await securityLoggerService.logSecurityEvent(
      SecurityEventType.LOGIN_SUCCESS,
      SecurityEventSeverity.LOW,
      'User logged in successfully',
      user.id.toString(),
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error: any) {
    console.error('로그인 에러:', error);
    await securityLoggerService.logSecurityEvent(
      SecurityEventType.SYSTEM_ERROR,
      SecurityEventSeverity.CRITICAL,
      'Login system error',
      null,
      req.ip,
      req.headers['user-agent'],
      { error: error?.message || 'Unknown error' }
    );
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
};

/**
 * 로그아웃 - 토큰 블랙리스트 처리 및 세션 종료
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return res.status(400).json({ message: '토큰이 필요합니다.' });
    }

    // 토큰 블랙리스트 처리
    await tokenService.blacklistToken(token);

    // 세션 종료
    if (req.user?.sessionId) {
      await sessionService.terminateSession(req.user.sessionId);
    }

    // 로그아웃 로그
    await securityLoggerService.logSecurityEvent(
      SecurityEventType.LOGOUT_SUCCESS,
      SecurityEventSeverity.LOW,
      'User logged out successfully',
      req.user?.id || null,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ message: '로그아웃되었습니다.' });
  } catch (error: any) {
    console.error('로그아웃 에러:', error);
    await securityLoggerService.logSecurityEvent(
      SecurityEventType.SYSTEM_ERROR,
      SecurityEventSeverity.CRITICAL,
      'Logout system error',
      req.user?.id || null,
      req.ip,
      req.headers['user-agent'],
      { error: error?.message || 'Unknown error' }
    );
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
};

/**
 * 리프레시 토큰으로 새 액세스 토큰 발급
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: '리프레시 토큰이 필요합니다.' });
    }

    // 리프레시 토큰 검증
    const decoded = await tokenService.verifyRefreshToken(refreshToken);
    
    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 새 액세스 토큰 생성
    const newAccessToken = await tokenService.generateAccessToken(user.id.toString(), user.email || '', decoded.sessionId);

    res.json({ accessToken: newAccessToken });
  } catch (error: any) {
    console.error('토큰 갱신 에러:', error);
    await securityLoggerService.logSecurityEvent(
      SecurityEventType.TOKEN_REFRESH_FAILED,
      SecurityEventSeverity.MEDIUM,
      'Token refresh failed',
      null,
      req.ip,
      req.headers['user-agent'],
      { error: error?.message || 'Unknown error' }
    );
    res.status(401).json({ message: '유효하지 않은 리프레시 토큰입니다.' });
  }
};

/**
 * 사용자의 모든 활성 세션 조회
 */
export const getSessions = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    const sessions = await sessionService.getUserActiveSessions(req.user.id);
    res.json({ sessions });
  } catch (error) {
    console.error('세션 조회 에러:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
};

/**
 * 모든 기기에서 로그아웃 (현재 세션 제외)
 */
export const logoutFromAllDevices = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id || !req.user?.sessionId) {
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    const terminatedCount = await sessionService.terminateOtherSessions(req.user.id, req.user.sessionId);

    // 로그
    await securityLoggerService.logSecurityEvent(
      SecurityEventType.LOGOUT_SUCCESS,
      SecurityEventSeverity.MEDIUM,
      'User logged out from all devices',
      req.user.id,
      req.ip,
      req.headers['user-agent'],
      { terminatedSessions: terminatedCount }
    );

    res.json({ 
      message: '다른 모든 기기에서 로그아웃되었습니다.',
      terminatedSessions: terminatedCount
    });
  } catch (error) {
    console.error('전체 로그아웃 에러:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
}; 