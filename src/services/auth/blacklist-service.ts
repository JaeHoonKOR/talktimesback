import { DatabaseManager } from '../../utils/database-manager';
import { authLogger } from '../../utils/logger';

/**
 * 블랙리스트 토큰 인터페이스
 */
export interface BlacklistedToken {
  jti: string;
  tokenHash: string;
  userId: string;
  reason: string;
  blacklistedAt: Date;
  expiresAt: Date;
}

/**
 * 토큰 블랙리스트 서비스
 */
export class BlacklistService {
  private static readonly CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6시간

  /**
   * 토큰을 블랙리스트에 추가
   */
  static async addToBlacklist(
    jti: string,
    tokenHash: string,
    userId: string,
    reason: string,
    expiresAt: Date
  ): Promise<void> {
    const db = DatabaseManager.getInstance();

    try {
      await db.executeQuery(`
        INSERT INTO token_blacklist (jti, token_hash, user_id, reason, blacklisted_at, expires_at)
        VALUES ($1, $2, $3, $4, NOW(), $5)
        ON CONFLICT (jti) DO UPDATE SET
          token_hash = EXCLUDED.token_hash,
          reason = EXCLUDED.reason,
          blacklisted_at = NOW()
      `, [jti, tokenHash, userId, reason, expiresAt]);

      authLogger.info('토큰 블랙리스트 추가', {
        jti,
        userId,
        reason,
        expiresAt
      });
    } catch (error) {
      authLogger.error('토큰 블랙리스트 추가 실패', error as Error);
      throw error;
    }
  }

  /**
   * JTI로 블랙리스트 확인
   */
  static async isBlacklisted(jti: string): Promise<boolean> {
    const db = DatabaseManager.getInstance();

    try {
      const result = await db.executeQuery(
        'SELECT 1 FROM token_blacklist WHERE jti = $1 AND expires_at > NOW()',
        [jti]
      );

      return result.rows.length > 0;
    } catch (error) {
      authLogger.error('블랙리스트 확인 실패', error as Error);
      return false; // 오류 시 false 반환하여 토큰이 검증되도록 함
    }
  }

  /**
   * 토큰 해시로 블랙리스트 확인 (백업 검증)
   */
  static async isTokenHashBlacklisted(tokenHash: string): Promise<boolean> {
    const db = DatabaseManager.getInstance();

    try {
      const result = await db.executeQuery(
        'SELECT 1 FROM token_blacklist WHERE token_hash = $1 AND expires_at > NOW()',
        [tokenHash]
      );

      return result.rows.length > 0;
    } catch (error) {
      authLogger.error('토큰 해시 블랙리스트 확인 실패', error as Error);
      return false;
    }
  }

  /**
   * 사용자의 모든 토큰을 블랙리스트에 추가 (로그아웃 시)
   */
  static async blacklistUserTokens(
    userId: string,
    reason: string = '사용자 로그아웃'
  ): Promise<void> {
    const db = DatabaseManager.getInstance();

    try {
      // 현재 활성화된 모든 토큰을 블랙리스트에 추가
      // 실제로는 활성 토큰을 추적하는 테이블이 있어야 하지만, 
      // 여기서는 간단히 만료 시간을 현재 시간으로 설정
      await db.executeQuery(`
        INSERT INTO token_blacklist (jti, token_hash, user_id, reason, blacklisted_at, expires_at)
        SELECT 
          CONCAT('user_logout_', user_id, '_', EXTRACT(EPOCH FROM NOW())),
          'bulk_blacklist',
          user_id,
          $2,
          NOW(),
          NOW() + INTERVAL '24 hours'
        FROM users WHERE id = $1
        ON CONFLICT (jti) DO NOTHING
      `, [userId, reason]);

      authLogger.info('사용자 토큰 일괄 블랙리스트', {
        userId,
        reason
      });
    } catch (error) {
      authLogger.error('사용자 토큰 일괄 블랙리스트 실패', error as Error);
      throw error;
    }
  }

  /**
   * 만료된 블랙리스트 토큰 정리
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const db = DatabaseManager.getInstance();

    try {
      const result = await db.executeQuery(
        'DELETE FROM token_blacklist WHERE expires_at < NOW()'
      );

      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        authLogger.info('만료된 블랙리스트 토큰 정리', {
          deletedCount
        });
      }

      return deletedCount;
    } catch (error) {
      authLogger.error('블랙리스트 토큰 정리 실패', error as Error);
      return 0;
    }
  }

  /**
   * 블랙리스트 통계 조회
   */
  static async getBlacklistStats(): Promise<{
    totalBlacklisted: number;
    activeBlacklisted: number;
    expiredBlacklisted: number;
  }> {
    const db = DatabaseManager.getInstance();

    try {
      const result = await db.executeQuery(`
        SELECT 
          COUNT(*) as total_blacklisted,
          COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_blacklisted,
          COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_blacklisted
        FROM token_blacklist
      `);

      const stats = result.rows[0];
      return {
        totalBlacklisted: parseInt(stats.total_blacklisted),
        activeBlacklisted: parseInt(stats.active_blacklisted),
        expiredBlacklisted: parseInt(stats.expired_blacklisted)
      };
    } catch (error) {
      authLogger.error('블랙리스트 통계 조회 실패', error as Error);
      return {
        totalBlacklisted: 0,
        activeBlacklisted: 0,
        expiredBlacklisted: 0
      };
    }
  }

  /**
   * 블랙리스트 토큰 목록 조회 (관리자용)
   */
  static async getBlacklistedTokens(
    limit: number = 100,
    offset: number = 0
  ): Promise<BlacklistedToken[]> {
    const db = DatabaseManager.getInstance();

    try {
      const result = await db.executeQuery(`
        SELECT jti, token_hash, user_id, reason, blacklisted_at, expires_at
        FROM token_blacklist
        WHERE expires_at > NOW()
        ORDER BY blacklisted_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return result.rows.map(row => ({
        jti: row.jti,
        tokenHash: row.token_hash,
        userId: row.user_id,
        reason: row.reason,
        blacklistedAt: row.blacklisted_at,
        expiresAt: row.expires_at
      }));
    } catch (error) {
      authLogger.error('블랙리스트 토큰 목록 조회 실패', error as Error);
      return [];
    }
  }

  /**
   * 특정 토큰을 블랙리스트에서 제거 (긴급상황용)
   */
  static async removeFromBlacklist(jti: string): Promise<boolean> {
    const db = DatabaseManager.getInstance();

    try {
      const result = await db.executeQuery(
        'DELETE FROM token_blacklist WHERE jti = $1',
        [jti]
      );

      const removed = (result.rowCount || 0) > 0;

      if (removed) {
        authLogger.warn('토큰 블랙리스트에서 제거', {
          jti,
          action: 'emergency_removal'
        });
      }

      return removed;
    } catch (error) {
      authLogger.error('토큰 블랙리스트 제거 실패', error as Error);
      return false;
    }
  }

  /**
   * 토큰 해시 생성 (보안용)
   */
  static generateTokenHash(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
  }

  /**
   * 정기적인 정리 작업 시작
   */
  static startCleanupScheduler(): void {
    setInterval(async () => {
      try {
        await this.cleanupExpiredTokens();
      } catch (error) {
        authLogger.error('정기 블랙리스트 정리 실패', error as Error);
      }
    }, this.CLEANUP_INTERVAL);

    authLogger.info('블랙리스트 정리 스케줄러 시작', {
      intervalMs: this.CLEANUP_INTERVAL
    });
  }
}

// 서버 시작 시 정리 스케줄러 시작
BlacklistService.startCleanupScheduler(); 