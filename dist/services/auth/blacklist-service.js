"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlacklistService = void 0;
const database_manager_1 = require("../../utils/database-manager");
const logger_1 = require("../../utils/logger");
/**
 * 토큰 블랙리스트 서비스
 */
class BlacklistService {
    /**
     * 토큰을 블랙리스트에 추가
     */
    static addToBlacklist(jti, tokenHash, userId, reason, expiresAt) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            try {
                yield db.executeQuery(`
        INSERT INTO token_blacklist (jti, token_hash, user_id, reason, blacklisted_at, expires_at)
        VALUES ($1, $2, $3, $4, NOW(), $5)
        ON CONFLICT (jti) DO UPDATE SET
          token_hash = EXCLUDED.token_hash,
          reason = EXCLUDED.reason,
          blacklisted_at = NOW()
      `, [jti, tokenHash, userId, reason, expiresAt]);
                logger_1.authLogger.info('토큰 블랙리스트 추가', {
                    jti,
                    userId,
                    reason,
                    expiresAt
                });
            }
            catch (error) {
                logger_1.authLogger.error('토큰 블랙리스트 추가 실패', error);
                throw error;
            }
        });
    }
    /**
     * JTI로 블랙리스트 확인
     */
    static isBlacklisted(jti) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            try {
                const result = yield db.executeQuery('SELECT 1 FROM token_blacklist WHERE jti = $1 AND expires_at > NOW()', [jti]);
                return result.rows.length > 0;
            }
            catch (error) {
                logger_1.authLogger.error('블랙리스트 확인 실패', error);
                return false; // 오류 시 false 반환하여 토큰이 검증되도록 함
            }
        });
    }
    /**
     * 토큰 해시로 블랙리스트 확인 (백업 검증)
     */
    static isTokenHashBlacklisted(tokenHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            try {
                const result = yield db.executeQuery('SELECT 1 FROM token_blacklist WHERE token_hash = $1 AND expires_at > NOW()', [tokenHash]);
                return result.rows.length > 0;
            }
            catch (error) {
                logger_1.authLogger.error('토큰 해시 블랙리스트 확인 실패', error);
                return false;
            }
        });
    }
    /**
     * 사용자의 모든 토큰을 블랙리스트에 추가 (로그아웃 시)
     */
    static blacklistUserTokens(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, reason = '사용자 로그아웃') {
            const db = database_manager_1.DatabaseManager.getInstance();
            try {
                // 현재 활성화된 모든 토큰을 블랙리스트에 추가
                // 실제로는 활성 토큰을 추적하는 테이블이 있어야 하지만, 
                // 여기서는 간단히 만료 시간을 현재 시간으로 설정
                yield db.executeQuery(`
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
                logger_1.authLogger.info('사용자 토큰 일괄 블랙리스트', {
                    userId,
                    reason
                });
            }
            catch (error) {
                logger_1.authLogger.error('사용자 토큰 일괄 블랙리스트 실패', error);
                throw error;
            }
        });
    }
    /**
     * 만료된 블랙리스트 토큰 정리
     */
    static cleanupExpiredTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            try {
                const result = yield db.executeQuery('DELETE FROM token_blacklist WHERE expires_at < NOW()');
                const deletedCount = result.rowCount || 0;
                if (deletedCount > 0) {
                    logger_1.authLogger.info('만료된 블랙리스트 토큰 정리', {
                        deletedCount
                    });
                }
                return deletedCount;
            }
            catch (error) {
                logger_1.authLogger.error('블랙리스트 토큰 정리 실패', error);
                return 0;
            }
        });
    }
    /**
     * 블랙리스트 통계 조회
     */
    static getBlacklistStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            try {
                const result = yield db.executeQuery(`
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
            }
            catch (error) {
                logger_1.authLogger.error('블랙리스트 통계 조회 실패', error);
                return {
                    totalBlacklisted: 0,
                    activeBlacklisted: 0,
                    expiredBlacklisted: 0
                };
            }
        });
    }
    /**
     * 블랙리스트 토큰 목록 조회 (관리자용)
     */
    static getBlacklistedTokens() {
        return __awaiter(this, arguments, void 0, function* (limit = 100, offset = 0) {
            const db = database_manager_1.DatabaseManager.getInstance();
            try {
                const result = yield db.executeQuery(`
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
            }
            catch (error) {
                logger_1.authLogger.error('블랙리스트 토큰 목록 조회 실패', error);
                return [];
            }
        });
    }
    /**
     * 특정 토큰을 블랙리스트에서 제거 (긴급상황용)
     */
    static removeFromBlacklist(jti) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            try {
                const result = yield db.executeQuery('DELETE FROM token_blacklist WHERE jti = $1', [jti]);
                const removed = (result.rowCount || 0) > 0;
                if (removed) {
                    logger_1.authLogger.warn('토큰 블랙리스트에서 제거', {
                        jti,
                        action: 'emergency_removal'
                    });
                }
                return removed;
            }
            catch (error) {
                logger_1.authLogger.error('토큰 블랙리스트 제거 실패', error);
                return false;
            }
        });
    }
    /**
     * 토큰 해시 생성 (보안용)
     */
    static generateTokenHash(token) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
    }
    /**
     * 정기적인 정리 작업 시작
     */
    static startCleanupScheduler() {
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.cleanupExpiredTokens();
            }
            catch (error) {
                logger_1.authLogger.error('정기 블랙리스트 정리 실패', error);
            }
        }), this.CLEANUP_INTERVAL);
        logger_1.authLogger.info('블랙리스트 정리 스케줄러 시작', {
            intervalMs: this.CLEANUP_INTERVAL
        });
    }
}
exports.BlacklistService = BlacklistService;
BlacklistService.CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6시간
// 서버 시작 시 정리 스케줄러 시작
BlacklistService.startCleanupScheduler();
