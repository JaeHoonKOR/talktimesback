import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

/**
 * 토큰 서비스 - JWT 토큰 생성, 검증, 관리를 담당
 */
export class TokenService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-key';
    this.accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1h';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';

    if (process.env.NODE_ENV === 'production' && this.jwtSecret === 'your-jwt-secret-key') {
      console.warn('경고: 프로덕션 환경에서 기본 JWT 시크릿 키를 사용 중입니다.');
    }
  }

  /**
   * 액세스 토큰 생성 (세션 ID 포함)
   */
  async generateAccessToken(userId: string, email: string, sessionId: string): Promise<string> {
    const payload = {
      userId,
      email,
      sessionId,
      type: 'access'
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, { 
      expiresIn: '15m' // 15분으로 고정
    });
  }

  /**
   * 리프레시 토큰 생성
   */
  async generateRefreshToken(userId: string, sessionId: string): Promise<string> {
    const payload = {
      userId,
      sessionId,
      type: 'refresh'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, { 
      expiresIn: '7d' // 7일로 고정
    });

    // 토큰 해시 생성 및 저장
    const tokenHash = await this.hashToken(token);
    
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        sessionId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7일
      }
    });

    return token;
  }

  /**
   * 토큰 검증 (미들웨어용)
   */
  async verifyToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // 토큰이 블랙리스트에 있는지 확인
      if (decoded.jti) {
        const isBlacklisted = await this.isTokenBlacklisted(decoded.jti);
        if (isBlacklisted) {
          throw new Error('Blacklisted token');
        }
      }
      
      return decoded;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 리프레시 토큰 검증 (컨트롤러용)
   */
  async verifyRefreshToken(token: string): Promise<any> {
    const tokenHash = await this.hashToken(token);

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        isRevoked: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!storedToken) {
      throw new Error('Invalid refresh token');
    }

    return {
      userId: storedToken.userId,
      sessionId: storedToken.sessionId
    };
  }

  /**
   * 리프레시 토큰 폐기
   */
  async revokeRefreshToken(token: string): Promise<boolean> {
    const tokenHash = await this.hashToken(token);

    const result = await prisma.refreshToken.updateMany({
      where: {
        tokenHash
      },
      data: {
        isRevoked: true,
        updatedAt: new Date()
      }
    });

    return result.count > 0;
  }

  /**
   * 사용자의 모든 리프레시 토큰 폐기
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false
      },
      data: {
        isRevoked: true,
        updatedAt: new Date()
      }
    });

    return result.count;
  }

  /**
   * 토큰 블랙리스트에 추가 (단순 토큰으로)
   */
  async blacklistToken(token: string, reason: string = '사용자 로그아웃'): Promise<void> {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.jti || !decoded.exp) {
        throw new Error('유효하지 않은 토큰입니다.');
      }

      const jti = decoded.jti;
      const tokenHash = await this.hashToken(token);
      const expiresAt = new Date(decoded.exp * 1000);

      await prisma.tokenBlacklist.create({
        data: {
          jti,
          tokenHash,
          userId: decoded.userId || decoded.id,
          reason,
          expiresAt
        }
      });
    } catch (error) {
      console.error('토큰 블랙리스트 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 토큰이 블랙리스트에 있는지 확인 (토큰으로)
   */
  async isTokenBlacklisted(tokenOrJti: string): Promise<boolean> {
    let jti = tokenOrJti;
    
    // 토큰인 경우 JTI 추출
    if (tokenOrJti.includes('.')) {
      try {
        const decoded = jwt.decode(tokenOrJti) as any;
        jti = decoded?.jti;
      } catch (error) {
        return false;
      }
    }

    if (!jti) return false;

    const blacklistedToken = await prisma.tokenBlacklist.findFirst({
      where: {
        jti
      }
    });

    return !!blacklistedToken;
  }

  /**
   * 만료된 블랙리스트 토큰 정리
   */
  async cleanupBlacklistedTokens(): Promise<number> {
    const result = await prisma.tokenBlacklist.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    return result.count;
  }

  /**
   * 토큰 해시 생성 (보안을 위해 원본 토큰 대신 해시 저장)
   */
  private async hashToken(token: string): Promise<string> {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export default new TokenService(); 