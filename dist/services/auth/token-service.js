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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_manager_1 = require("../../utils/database-manager");
const logger_1 = require("../../utils/logger");
/**
 * 토큰 서비스 클래스
 */
class TokenService {
    /**
     * 액세스 토큰 생성
     */
    static generateAccessToken(user, sessionId, options = {}) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET이 설정되지 않았습니다.');
        }
        const generatedSessionId = sessionId || this.generateSessionId();
        const jti = this.generateJTI();
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            sessionId: generatedSessionId,
            jti
        };
        const tokenOptions = {
            expiresIn: String(options.expiresIn || this.DEFAULT_ACCESS_TOKEN_EXPIRES),
            issuer: options.issuer || this.TOKEN_ISSUER,
            audience: options.audience || this.TOKEN_AUDIENCE,
            subject: user.id,
            jwtid: jti
        };
        const token = jsonwebtoken_1.default.sign(payload, secret, tokenOptions);
        logger_1.authLogger.info('액세스 토큰 생성', {
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
    static generateRefreshToken(userId_1, sessionId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, sessionId, options = {}) {
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
            const tokenOptions = {
                expiresIn: String(expiresIn),
                issuer: this.TOKEN_ISSUER,
                audience: this.TOKEN_AUDIENCE,
                subject: userId,
                jwtid: jti
            };
            const token = jsonwebtoken_1.default.sign(payload, secret, tokenOptions);
            // 리프레시 토큰을 데이터베이스에 저장
            yield this.storeRefreshToken(token, userId, sessionId, expiresIn);
            logger_1.authLogger.info('리프레시 토큰 생성', {
                userId,
                sessionId,
                jti,
                expiresIn
            });
            return token;
        });
    }
    /**
     * 토큰 검증
     */
    static verifyToken(token) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET이 설정되지 않았습니다.');
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, secret, {
                issuer: this.TOKEN_ISSUER,
                audience: this.TOKEN_AUDIENCE
            });
            return decoded;
        }
        catch (error) {
            logger_1.authLogger.warn('토큰 검증 실패', {
                error: error.message,
                tokenHash: this.hashToken(token)
            });
            throw error;
        }
    }
    /**
     * 토큰 갱신
     */
    static refreshAccessToken(refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error('JWT_SECRET이 설정되지 않았습니다.');
            }
            // 리프레시 토큰 검증
            let decoded;
            try {
                decoded = jsonwebtoken_1.default.verify(refreshToken, secret);
            }
            catch (error) {
                logger_1.authLogger.warn('리프레시 토큰 검증 실패', {
                    error: error.message
                });
                throw new Error('유효하지 않은 리프레시 토큰입니다.');
            }
            // 데이터베이스에서 리프레시 토큰 확인
            const storedToken = yield this.getRefreshToken(refreshToken);
            if (!storedToken || storedToken.isRevoked) {
                logger_1.authLogger.warn('무효하거나 폐기된 리프레시 토큰 사용 시도', {
                    userId: decoded.userId,
                    jti: decoded.jti
                });
                throw new Error('유효하지 않은 리프레시 토큰입니다.');
            }
            // 만료 시간 확인
            if (storedToken.expiresAt < new Date()) {
                logger_1.authLogger.warn('만료된 리프레시 토큰 사용 시도', {
                    userId: decoded.userId,
                    expiredAt: storedToken.expiresAt
                });
                throw new Error('리프레시 토큰이 만료되었습니다.');
            }
            // 사용자 정보 조회
            const db = database_manager_1.DatabaseManager.getInstance();
            const userResult = yield db.executeQuery('SELECT id, email, role FROM users WHERE id = $1 AND is_active = true', [decoded.userId]);
            if (userResult.rows.length === 0) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }
            const user = userResult.rows[0];
            // 기존 리프레시 토큰 폐기
            yield this.revokeRefreshToken(refreshToken);
            // 새로운 토큰들 생성
            const newSessionId = this.generateSessionId();
            const newAccessToken = this.generateAccessToken(user, newSessionId);
            const newRefreshToken = yield this.generateRefreshToken(user.id, newSessionId);
            logger_1.authLogger.info('토큰 갱신 완료', {
                userId: user.id,
                oldSessionId: decoded.sessionId,
                newSessionId
            });
            return {
                accessToken: newAccessToken,
                newRefreshToken,
                user
            };
        });
    }
    /**
     * 토큰 폐기 (로그아웃)
     */
    static revokeTokens(userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            if (sessionId) {
                // 특정 세션의 토큰만 폐기
                yield db.executeQuery('UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND session_id = $2', [userId, sessionId]);
            }
            else {
                // 사용자의 모든 토큰 폐기
                yield db.executeQuery('UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1', [userId]);
            }
            logger_1.authLogger.info('토큰 폐기 완료', {
                userId,
                sessionId: sessionId || 'all_sessions'
            });
        });
    }
    /**
     * 세션 ID 생성
     */
    static generateSessionId() {
        return `session_${Date.now()}_${crypto_1.default.randomBytes(8).toString('hex')}`;
    }
    /**
     * JWT ID (JTI) 생성
     */
    static generateJTI() {
        return `jti_${Date.now()}_${crypto_1.default.randomBytes(16).toString('hex')}`;
    }
    /**
     * 토큰 해시 (로깅용)
     */
    static hashToken(token) {
        return token.substring(0, 8) + '...' + token.substring(token.length - 8);
    }
    /**
     * 리프레시 토큰을 데이터베이스에 저장
     */
    static storeRefreshToken(token, userId, sessionId, expiresIn) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            // 만료 시간 계산
            let expiresAt;
            if (typeof expiresIn === 'string') {
                const duration = this.parseDuration(expiresIn);
                expiresAt = new Date(Date.now() + duration);
            }
            else {
                expiresAt = new Date(Date.now() + expiresIn * 1000);
            }
            yield db.executeQuery(`
      INSERT INTO refresh_tokens (token, user_id, session_id, expires_at, is_revoked, created_at)
      VALUES ($1, $2, $3, $4, false, NOW())
      ON CONFLICT (token) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        session_id = EXCLUDED.session_id,
        expires_at = EXCLUDED.expires_at,
        is_revoked = false,
        created_at = NOW()
    `, [token, userId, sessionId, expiresAt]);
        });
    }
    /**
     * 리프레시 토큰 조회
     */
    static getRefreshToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            const result = yield db.executeQuery('SELECT token, user_id, session_id, expires_at, is_revoked FROM refresh_tokens WHERE token = $1', [token]);
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
        });
    }
    /**
     * 리프레시 토큰 폐기
     */
    static revokeRefreshToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            yield db.executeQuery('UPDATE refresh_tokens SET is_revoked = true WHERE token = $1', [token]);
        });
    }
    /**
     * 기간 문자열을 밀리초로 변환
     */
    static parseDuration(duration) {
        const match = duration.match(/^(\d+)([smhdw])$/);
        if (!match) {
            throw new Error(`잘못된 기간 형식: ${duration}`);
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        const multipliers = {
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
    static cleanupExpiredTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            const db = database_manager_1.DatabaseManager.getInstance();
            const result = yield db.executeQuery('DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = true');
            const deletedCount = result.rowCount || 0;
            if (deletedCount > 0) {
                logger_1.authLogger.info('만료된 토큰 정리 완료', {
                    deletedCount
                });
            }
            return deletedCount;
        });
    }
}
exports.TokenService = TokenService;
TokenService.DEFAULT_ACCESS_TOKEN_EXPIRES = '1h';
TokenService.DEFAULT_REFRESH_TOKEN_EXPIRES = '7d';
TokenService.TOKEN_ISSUER = 'jiksend-api';
TokenService.TOKEN_AUDIENCE = 'jiksend-client';
// 정기적으로 만료된 토큰 정리 (1시간마다)
setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield TokenService.cleanupExpiredTokens();
    }
    catch (error) {
        logger_1.authLogger.error('토큰 정리 작업 실패', error);
    }
}), 60 * 60 * 1000);
