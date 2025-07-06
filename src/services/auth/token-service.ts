import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { DatabaseManager } from '../../utils/database-manager';
import { authLogger } from '../../utils/logger';

/**
 * JWT 토큰 페이로드 인터페이스
 */
export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  sessionId: string;
  jti: string; // JWT ID (고유 식별자)
  iat?: number;
  exp?: number;
}

/**
 * 토큰 생성 옵션
 */
export interface TokenOptions {
  expiresIn?: string | number;
  audience?: string;
  issuer?: string;
  subject?: string;
}

/**
 * 리프레시 토큰 정보
 */
export interface RefreshTokenInfo {
  token: string;
  userId: string;
  sessionId: string;
  expiresAt: Date;
  isRevoked: boolean;
}

/**
 * 토큰 서비스 클래스
 */
export class TokenService {
  private static readonly DEFAULT_ACCESS_TOKEN_EXPIRES = '1h';
  private static readonly DEFAULT_REFRESH_TOKEN_EXPIRES = '7d';
  private static readonly TOKEN_ISSUER = 'jiksend-api';
  private static readonly TOKEN_AUDIENCE = 'jiksend-client';

  /**
   * 액세스 토큰 생성
   */
  static generateAccessToken(
    user: { id: string; email: string; role: string },
    sessionId?: string,
    options: TokenOptions = {}
  ): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }

    const generatedSessionId = sessionId || this.generateSessionId();
    const jti = this.generateJTI();

    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: generatedSessionId,
      jti
    };

    const tokenOptions: jwt.SignOptions = {
      expiresIn: (options.expiresIn || this.DEFAULT_ACCESS_TOKEN_EXPIRES) as any,
      issuer: options.issuer || this.TOKEN_ISSUER,
      audience: options.audience || this.TOKEN_AUDIENCE,
      subject: user.id,
      jwtid: jti
    };

    const token = jwt.sign(payload, secret, tokenOptions);

    authLogger.info('액세스 토큰 생성', {
      userId: user.id,
      sessionId: generatedSessionId,
      jti,
      expiresIn: tokenOptions.expiresIn
    });

    return token;
  }

  /**
   * 리프레시 토큰 생성
   */
  static async generateRefreshToken(
    userId: string,
    sessionId: string,
    options: TokenOptions = {}
  ): Promise<string> {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }

    const jti = this.generateJTI();
    const expiresIn = options.expiresIn || this.DEFAULT_REFRESH_TOKEN_EXPIRES;
    
    const payload = {
      userId,
      sessionId,
      type: 'refresh',
      jti
    };

    const tokenOptions: jwt.SignOptions = {
      expiresIn: expiresIn as any,
      issuer: this.TOKEN_ISSUER,
      audience: this.TOKEN_AUDIENCE,
      subject: userId,
      jwtid: jti
    };

    const token = jwt.sign(payload, secret, tokenOptions);

    // 리프레시 토큰을 데이터베이스에 저장
    await this.storeRefreshToken(token, userId, sessionId, expiresIn);

    authLogger.info('리프레시 토큰 생성', {
      userId,
      sessionId,
      jti,
      expiresIn
    });

    return token;
  }

  /**
   * 토큰 검증
   */
  static verifyToken(token: string): TokenPayload {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }

    try {
      const decoded = jwt.verify(token, secret, {
        issuer: this.TOKEN_ISSUER,
        audience: this.TOKEN_AUDIENCE
      }) as TokenPayload;

      return decoded;
    } catch (error: any) {
      authLogger.warn('토큰 검증 실패', {
        error: error.message,
        tokenHash: this.hashToken(token)
      });
      throw error;
    }
  }

  /**
   * 토큰 갱신
   */
  static async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    newRefreshToken: string;
    user: { id: string; email: string; role: string };
  }> {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }

    // 리프레시 토큰 검증
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, secret) as any;
    } catch (error) {
      authLogger.warn('리프레시 토큰 검증 실패', {
        error: (error as Error).message
      });
      throw new Error('유효하지 않은 리프레시 토큰입니다.');
    }

    // 데이터베이스에서 리프레시 토큰 확인
    const storedToken = await this.getRefreshToken(refreshToken);
    if (!storedToken || storedToken.isRevoked) {
      authLogger.warn('무효하거나 폐기된 리프레시 토큰 사용 시도', {
        userId: decoded.userId,
        jti: decoded.jti
      });
      throw new Error('유효하지 않은 리프레시 토큰입니다.');
    }

    // 만료 시간 확인
    if (storedToken.expiresAt < new Date()) {
      authLogger.warn('만료된 리프레시 토큰 사용 시도', {
        userId: decoded.userId,
        expiredAt: storedToken.expiresAt
      });
      throw new Error('리프레시 토큰이 만료되었습니다.');
    }

    // 사용자 정보 조회
    const db = DatabaseManager.getInstance();
    const userResult = await db.executeQuery(
      'SELECT id, email, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const user = userResult.rows[0];

    // 기존 리프레시 토큰 폐기
    await this.revokeRefreshToken(refreshToken);

    // 새로운 토큰들 생성
    const newSessionId = this.generateSessionId();
    const newAccessToken = this.generateAccessToken(user, newSessionId);
    const newRefreshToken = await this.generateRefreshToken(user.id, newSessionId);

    authLogger.info('토큰 갱신 완료', {
      userId: user.id,
      oldSessionId: decoded.sessionId,
      newSessionId
    });

    return {
      accessToken: newAccessToken,
      newRefreshToken,
      user
    };
  }

  /**
   * 토큰 폐기 (로그아웃)
   */
  static async revokeTokens(userId: string, sessionId?: string): Promise<void> {
    const db = DatabaseManager.getInstance();
    
    if (sessionId) {
      // 특정 세션의 토큰만 폐기
      await db.executeQuery(
        'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND session_id = $2',
        [userId, sessionId]
      );
    } else {
      // 사용자의 모든 토큰 폐기
      await db.executeQuery(
        'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1',
        [userId]
      );
    }

    authLogger.info('토큰 폐기 완료', {
      userId,
      sessionId: sessionId || 'all_sessions'
    });
  }

  /**
   * 세션 ID 생성
   */
  private static generateSessionId(): string {
    return `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * JWT ID (JTI) 생성
   */
  private static generateJTI(): string {
    return `jti_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * 토큰 해시 (로깅용)
   */
  private static hashToken(token: string): string {
    return token.substring(0, 8) + '...' + token.substring(token.length - 8);
  }

  /**
   * 리프레시 토큰을 데이터베이스에 저장
   */
  private static async storeRefreshToken(
    token: string,
    userId: string,
    sessionId: string,
    expiresIn: string | number
  ): Promise<void> {
    const db = DatabaseManager.getInstance();
    
    // 만료 시간 계산
    let expiresAt: Date;
    if (typeof expiresIn === 'string') {
      const duration = this.parseDuration(expiresIn);
      expiresAt = new Date(Date.now() + duration);
    } else {
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    }

    await db.executeQuery(`
      INSERT INTO refresh_tokens (token, user_id, session_id, expires_at, is_revoked, created_at)
      VALUES ($1, $2, $3, $4, false, NOW())
      ON CONFLICT (token) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        session_id = EXCLUDED.session_id,
        expires_at = EXCLUDED.expires_at,
        is_revoked = false,
        created_at = NOW()
    `, [token, userId, sessionId, expiresAt]);
  }

  /**
   * 리프레시 토큰 조회
   */
  private static async getRefreshToken(token: string): Promise<RefreshTokenInfo | null> {
    const db = DatabaseManager.getInstance();
    
    const result = await db.executeQuery(
      'SELECT token, user_id, session_id, expires_at, is_revoked FROM refresh_tokens WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      token: row.token,
      userId: row.user_id,
      sessionId: row.session_id,
      expiresAt: row.expires_at,
      isRevoked: row.is_revoked
    };
  }

  /**
   * 리프레시 토큰 폐기
   */
  private static async revokeRefreshToken(token: string): Promise<void> {
    const db = DatabaseManager.getInstance();
    
    await db.executeQuery(
      'UPDATE refresh_tokens SET is_revoked = true WHERE token = $1',
      [token]
    );
  }

  /**
   * 기간 문자열을 밀리초로 변환
   */
  private static parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error(`잘못된 기간 형식: ${duration}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers: { [key: string]: number } = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000
    };

    return value * multipliers[unit];
  }

  /**
   * 만료된 리프레시 토큰 정리
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const db = DatabaseManager.getInstance();
    
    const result = await db.executeQuery(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = true'
    );

    const deletedCount = result.rowCount || 0;
    
    if (deletedCount > 0) {
      authLogger.info('만료된 토큰 정리 완료', {
        deletedCount
      });
    }

    return deletedCount;
  }
}

// 정기적으로 만료된 토큰 정리 (1시간마다)
setInterval(async () => {
  try {
    await TokenService.cleanupExpiredTokens();
  } catch (error) {
    authLogger.error('토큰 정리 작업 실패', error as Error);
  }
}, 60 * 60 * 1000); 