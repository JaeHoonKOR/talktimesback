import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

/**
 * 보안 이벤트 심각도 수준
 */
export enum SecurityEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 보안 이벤트 유형
 */
export enum SecurityEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT_SUCCESS = 'logout_success',
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHENTICATION_FAILED = 'authentication_failed',
  REGISTRATION_SUCCESS = 'registration_success',
  REGISTRATION_FAILED = 'registration_failed',
  SESSION_EXPIRED = 'session_expired',
  TOKEN_REFRESH_FAILED = 'token_refresh_failed',
  SYSTEM_ERROR = 'system_error',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  ACCOUNT_LOCKOUT = 'account_lockout',
  SUSPICIOUS_LOGIN = 'suspicious_login',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_REVOKED = 'token_revoked',
  PERMISSION_CHANGE = 'permission_change',
  MULTIPLE_LOGIN_ATTEMPTS = 'multiple_login_attempts',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  API_ABUSE = 'api_abuse',
  SECURITY_SETTING_CHANGE = 'security_setting_change'
}

/**
 * 보안 이벤트 로깅 서비스 - 보안 관련 이벤트 기록 및 관리
 */
export class SecurityLoggerService {
  /**
   * 보안 이벤트 로그 기록 (메인 메서드)
   */
  async logSecurityEvent(
    eventType: SecurityEventType,
    severity: SecurityEventSeverity,
    description: string,
    userId?: string | null,
    ipAddress?: string | null,
    userAgent?: string | null,
    metadata?: any
  ): Promise<void> {
    try {
      await prisma.authEventLog.create({
        data: {
          eventType,
          userId,
          ipAddress,
          userAgent,
          details: metadata ? JSON.stringify(metadata) : undefined
        }
      });
    } catch (error) {
      console.error('보안 이벤트 로깅 실패:', error);
      // 로깅 실패는 애플리케이션 동작에 영향을 주지 않도록 에러를 던지지 않음
    }
  }

  /**
   * 보안 이벤트 로그 기록 (Request 객체 사용)
   */
  async logEvent(
    eventType: SecurityEventType,
    severity: SecurityEventSeverity,
    description: string,
    userId?: string,
    req?: Request,
    metadata?: any
  ): Promise<void> {
    try {
      const ipAddress = req ? this.getClientIp(req) : null;
      const userAgent = req?.headers['user-agent'] || null;

      await this.logSecurityEvent(
        eventType,
        severity,
        description,
        userId,
        ipAddress,
        userAgent,
        metadata
      );
    } catch (error) {
      console.error('보안 이벤트 로깅 실패:', error);
      // 로깅 실패는 애플리케이션 동작에 영향을 주지 않도록 에러를 던지지 않음
    }
  }

  /**
   * 로그인 성공 이벤트 로깅
   */
  async logLoginSuccess(userId: string, req: Request): Promise<void> {
    await this.logEvent(
      SecurityEventType.LOGIN_SUCCESS,
      SecurityEventSeverity.LOW,
      '사용자 로그인 성공',
      userId,
      req,
      { method: 'standard' }
    );
  }

  /**
   * 로그인 실패 이벤트 로깅
   */
  async logLoginFailure(userId: string | undefined, req: Request, reason: string): Promise<void> {
    await this.logEvent(
      SecurityEventType.LOGIN_FAILURE,
      SecurityEventSeverity.MEDIUM,
      '사용자 로그인 실패',
      userId,
      req,
      { reason }
    );
  }

  /**
   * 로그아웃 이벤트 로깅
   */
  async logLogout(userId: string, req: Request): Promise<void> {
    await this.logEvent(
      SecurityEventType.LOGOUT,
      SecurityEventSeverity.LOW,
      '사용자 로그아웃',
      userId,
      req
    );
  }

  /**
   * 비밀번호 변경 이벤트 로깅
   */
  async logPasswordChange(userId: string, req: Request): Promise<void> {
    await this.logEvent(
      SecurityEventType.PASSWORD_CHANGE,
      SecurityEventSeverity.MEDIUM,
      '비밀번호 변경',
      userId,
      req
    );
  }

  /**
   * 비밀번호 재설정 이벤트 로깅
   */
  async logPasswordReset(userId: string, req: Request): Promise<void> {
    await this.logEvent(
      SecurityEventType.PASSWORD_RESET,
      SecurityEventSeverity.MEDIUM,
      '비밀번호 재설정',
      userId,
      req
    );
  }

  /**
   * 계정 잠금 이벤트 로깅
   */
  async logAccountLockout(userId: string, req: Request, reason: string): Promise<void> {
    await this.logEvent(
      SecurityEventType.ACCOUNT_LOCKOUT,
      SecurityEventSeverity.HIGH,
      '계정 잠금',
      userId,
      req,
      { reason }
    );
  }

  /**
   * 의심스러운 로그인 이벤트 로깅
   */
  async logSuspiciousLogin(userId: string, req: Request, reason: string): Promise<void> {
    await this.logEvent(
      SecurityEventType.SUSPICIOUS_LOGIN,
      SecurityEventSeverity.HIGH,
      '의심스러운 로그인 시도',
      userId,
      req,
      { reason }
    );
  }

  /**
   * 토큰 갱신 이벤트 로깅
   */
  async logTokenRefresh(userId: string, req: Request): Promise<void> {
    await this.logEvent(
      SecurityEventType.TOKEN_REFRESH,
      SecurityEventSeverity.LOW,
      '토큰 갱신',
      userId,
      req
    );
  }

  /**
   * 토큰 폐기 이벤트 로깅
   */
  async logTokenRevoked(userId: string, req: Request, reason: string): Promise<void> {
    await this.logEvent(
      SecurityEventType.TOKEN_REVOKED,
      SecurityEventSeverity.MEDIUM,
      '토큰 폐기',
      userId,
      req,
      { reason }
    );
  }

  /**
   * 다중 로그인 시도 이벤트 로깅
   */
  async logMultipleLoginAttempts(identifier: string, req: Request, count: number): Promise<void> {
    await this.logEvent(
      SecurityEventType.MULTIPLE_LOGIN_ATTEMPTS,
      SecurityEventSeverity.HIGH,
      '다중 로그인 시도',
      undefined,
      req,
      { identifier, count }
    );
  }

  /**
   * 브루트 포스 공격 시도 이벤트 로깅
   */
  async logBruteForceAttempt(identifier: string, req: Request): Promise<void> {
    await this.logEvent(
      SecurityEventType.BRUTE_FORCE_ATTEMPT,
      SecurityEventSeverity.CRITICAL,
      '브루트 포스 공격 시도',
      undefined,
      req,
      { identifier }
    );
  }

  /**
   * API 남용 이벤트 로깅
   */
  async logApiAbuse(userId: string | undefined, req: Request, endpoint: string, count: number): Promise<void> {
    await this.logEvent(
      SecurityEventType.API_ABUSE,
      SecurityEventSeverity.HIGH,
      'API 남용',
      userId,
      req,
      { endpoint, count }
    );
  }

  /**
   * 사용자 보안 설정 변경 이벤트 로깅
   */
  async logSecuritySettingChange(userId: string, req: Request, setting: string): Promise<void> {
    await this.logEvent(
      SecurityEventType.SECURITY_SETTING_CHANGE,
      SecurityEventSeverity.MEDIUM,
      '보안 설정 변경',
      userId,
      req,
      { setting }
    );
  }

  /**
   * 사용자별 보안 이벤트 로그 조회
   */
  async getUserSecurityLogs(userId: string, limit: number = 50): Promise<any[]> {
    return prisma.authEventLog.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
  }

  /**
   * 이벤트 유형별 보안 이벤트 로그 조회
   */
  async getSecurityLogsByEventType(eventType: SecurityEventType, limit: number = 50): Promise<any[]> {
    return prisma.authEventLog.findMany({
      where: {
        eventType
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
  }

  /**
   * 클라이언트 IP 주소 추출
   */
  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      return Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '';
  }
}

export default new SecurityLoggerService(); 