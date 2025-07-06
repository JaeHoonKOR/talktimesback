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
exports.refreshTokenIfNeeded = exports.requireAdmin = exports.logoutToken = exports.enhancedAuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const database_manager_1 = require("../utils/database-manager");
const logger_1 = require("../utils/logger");
/**
 * 토큰 블랙리스트 관리
 */
class TokenBlacklist {
    /**
     * 토큰을 블랙리스트에 추가
     */
    static addToken(token, expiresAt) {
        this.blacklistedTokens.add(token);
        this.expiryTimes.set(token, expiresAt);
        logger_1.authLogger.info('토큰 블랙리스트 추가', {
            tokenHash: this.hashToken(token),
            expiresAt: new Date(expiresAt * 1000).toISOString()
        });
    }
    /**
     * 토큰이 블랙리스트에 있는지 확인
     */
    static isBlacklisted(token) {
        return this.blacklistedTokens.has(token);
    }
    /**
     * 만료된 토큰들을 블랙리스트에서 제거
     */
    static cleanup() {
        const now = Math.floor(Date.now() / 1000);
        const tokensToRemove = [];
        for (const [token, expiresAt] of this.expiryTimes.entries()) {
            if (expiresAt < now) {
                tokensToRemove.push(token);
            }
        }
        tokensToRemove.forEach(token => {
            this.blacklistedTokens.delete(token);
            this.expiryTimes.delete(token);
        });
        if (tokensToRemove.length > 0) {
            logger_1.authLogger.debug('만료된 블랙리스트 토큰 정리', {
                removedCount: tokensToRemove.length
            });
        }
    }
    /**
     * 토큰 해시 생성 (로깅용)
     */
    static hashToken(token) {
        return token.substring(0, 8) + '...' + token.substring(token.length - 8);
    }
}
TokenBlacklist.blacklistedTokens = new Set();
TokenBlacklist.expiryTimes = new Map();
/**
 * Rate Limiter 설정 (인증 실패 방지)
 */
const authFailureLimiter = new rate_limiter_flexible_1.RateLimiterRedis({
    storeClient: null, // Redis 클라이언트 (없으면 메모리 사용)
    keyPrefix: 'auth_fail',
    points: 5, // 5번의 실패 허용
    duration: 900, // 15분
    blockDuration: 900, // 15분 차단
});
const authSuccessLimiter = new rate_limiter_flexible_1.RateLimiterRedis({
    storeClient: null,
    keyPrefix: 'auth_success',
    points: 100, // 100번의 성공적인 요청 허용
    duration: 60, // 1분
    blockDuration: 60, // 1분 차단
});
/**
 * 토큰 검증 및 사용자 인증 미들웨어 (보안 강화)
 */
const enhancedAuthMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const startTime = Date.now();
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        // 1. Authorization 헤더 확인
        const authHeader = req.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger_1.authLogger.warn('인증 토큰 누락', {
                ip: clientIp,
                userAgent,
                path: req.originalUrl
            });
            res.status(401).json({
                success: false,
                error: {
                    message: '인증 토큰이 필요합니다.',
                    code: 'AUTH_TOKEN_REQUIRED'
                }
            });
            return;
        }
        const token = authHeader.split(' ')[1];
        // 2. 토큰 형식 기본 검증
        if (!token || token.length < 10) {
            logger_1.authLogger.warn('잘못된 토큰 형식', {
                ip: clientIp,
                tokenLength: (token === null || token === void 0 ? void 0 : token.length) || 0
            });
            res.status(401).json({
                success: false,
                error: {
                    message: '잘못된 토큰 형식입니다.',
                    code: 'INVALID_TOKEN_FORMAT'
                }
            });
            return;
        }
        // 3. Rate Limiting 체크
        try {
            yield authSuccessLimiter.consume(clientIp || 'unknown');
        }
        catch (rateLimitError) {
            logger_1.authLogger.warn('인증 요청 Rate Limit 초과', {
                ip: clientIp,
                userAgent
            });
            res.status(429).json({
                success: false,
                error: {
                    message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
                    code: 'RATE_LIMIT_EXCEEDED'
                }
            });
            return;
        }
        // 4. 토큰 블랙리스트 확인
        if (TokenBlacklist.isBlacklisted(token)) {
            logger_1.authLogger.warn('블랙리스트된 토큰 사용 시도', {
                ip: clientIp,
                tokenHash: token.substring(0, 8) + '...'
            });
            res.status(401).json({
                success: false,
                error: {
                    message: '유효하지 않은 토큰입니다.',
                    code: 'TOKEN_BLACKLISTED'
                }
            });
            return;
        }
        // 5. JWT 토큰 검증
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            logger_1.authLogger.fatal('JWT_SECRET 환경 변수가 설정되지 않음');
            res.status(500).json({
                success: false,
                error: {
                    message: '서버 설정 오류입니다.',
                    code: 'SERVER_CONFIG_ERROR'
                }
            });
            return;
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, secret);
        }
        catch (jwtError) {
            // JWT 검증 실패 Rate Limiting
            try {
                yield authFailureLimiter.consume(clientIp || 'unknown');
            }
            catch (limitError) {
                logger_1.authLogger.warn('인증 실패 Rate Limit 초과', {
                    ip: clientIp,
                    error: jwtError.message
                });
                res.status(429).json({
                    success: false,
                    error: {
                        message: '인증 실패가 너무 많습니다. 15분 후 다시 시도해주세요.',
                        code: 'AUTH_FAILURE_RATE_LIMIT'
                    }
                });
                return;
            }
            logger_1.authLogger.warn('JWT 토큰 검증 실패', {
                ip: clientIp,
                error: jwtError.message,
                tokenHash: token.substring(0, 8) + '...'
            });
            const errorMessage = jwtError.name === 'TokenExpiredError'
                ? '토큰이 만료되었습니다.'
                : '유효하지 않은 토큰입니다.';
            res.status(401).json({
                success: false,
                error: {
                    message: errorMessage,
                    code: jwtError.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
                }
            });
            return;
        }
        // 6. 토큰 만료 시간 추가 검증
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
            logger_1.authLogger.warn('만료된 토큰 사용 시도', {
                ip: clientIp,
                userId: decoded.id,
                expiredAt: new Date(decoded.exp * 1000).toISOString()
            });
            res.status(401).json({
                success: false,
                error: {
                    message: '토큰이 만료되었습니다.',
                    code: 'TOKEN_EXPIRED'
                }
            });
            return;
        }
        // 7. 토큰 발급 시간 검증 (너무 오래된 토큰 거부)
        const tokenAge = now - (decoded.iat || 0);
        const MAX_TOKEN_AGE = 24 * 60 * 60; // 24시간
        if (tokenAge > MAX_TOKEN_AGE) {
            logger_1.authLogger.warn('너무 오래된 토큰 사용 시도', {
                ip: clientIp,
                userId: decoded.id,
                tokenAgeHours: tokenAge / 3600
            });
            res.status(401).json({
                success: false,
                error: {
                    message: '토큰이 너무 오래되었습니다. 다시 로그인해주세요.',
                    code: 'TOKEN_TOO_OLD'
                }
            });
            return;
        }
        // 8. 데이터베이스에서 사용자 정보 확인
        const db = database_manager_1.DatabaseManager.getInstance();
        let user;
        try {
            const result = yield db.executeQuery('SELECT id, email, name, role, is_active, updated_at FROM users WHERE id = $1', [decoded.id]);
            user = result.rows[0];
        }
        catch (dbError) {
            logger_1.authLogger.error('사용자 조회 데이터베이스 오류', dbError, {
                userId: decoded.id,
                ip: clientIp
            });
            res.status(500).json({
                success: false,
                error: {
                    message: '사용자 정보를 확인할 수 없습니다.',
                    code: 'USER_LOOKUP_ERROR'
                }
            });
            return;
        }
        // 9. 사용자 존재 여부 및 활성 상태 확인
        if (!user) {
            logger_1.authLogger.warn('존재하지 않는 사용자 토큰 사용', {
                userId: decoded.id,
                ip: clientIp
            });
            res.status(401).json({
                success: false,
                error: {
                    message: '사용자를 찾을 수 없습니다.',
                    code: 'USER_NOT_FOUND'
                }
            });
            return;
        }
        if (!user.is_active) {
            logger_1.authLogger.warn('비활성 사용자 토큰 사용', {
                userId: decoded.id,
                ip: clientIp
            });
            res.status(401).json({
                success: false,
                error: {
                    message: '비활성화된 계정입니다.',
                    code: 'ACCOUNT_DISABLED'
                }
            });
            return;
        }
        // 10. 세션 ID 생성 (토큰에 없으면 생성)
        const sessionId = decoded.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // 11. 사용자 정보를 요청 객체에 추가
        req.enhancedUser = {
            id: user.id,
            email: user.email,
            role: user.role || 'user',
            sessionId,
            lastActivity: new Date(),
            tokenIssuedAt: new Date((decoded.iat || 0) * 1000),
            isAuthenticated: true
        };
        // 12. 성공 로그 기록
        const processingTime = Date.now() - startTime;
        logger_1.authLogger.info('인증 성공', {
            userId: user.id,
            email: user.email,
            ip: clientIp,
            userAgent,
            sessionId,
            processingTimeMs: processingTime,
            path: req.originalUrl
        });
        // 13. 토큰 블랙리스트 정리 (주기적)
        if (Math.random() < 0.01) { // 1% 확률로 실행
            TokenBlacklist.cleanup();
        }
        next();
    }
    catch (error) {
        logger_1.authLogger.error('인증 미들웨어 오류', error, {
            ip: req.ip,
            path: req.originalUrl
        });
        res.status(500).json({
            success: false,
            error: {
                message: '인증 처리 중 오류가 발생했습니다.',
                code: 'AUTHENTICATION_ERROR'
            }
        });
        return;
    }
});
exports.enhancedAuthMiddleware = enhancedAuthMiddleware;
/**
 * 토큰 로그아웃 (블랙리스트 추가)
 */
const logoutToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: {
                    message: '인증 토큰이 필요합니다.',
                    code: 'AUTH_TOKEN_REQUIRED'
                }
            });
            return;
        }
        const token = authHeader.split(' ')[1];
        // 토큰을 블랙리스트에 추가
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        TokenBlacklist.addToken(token, decoded.exp || 0);
        logger_1.authLogger.info('토큰 로그아웃', {
            userId: decoded.id,
            ip: req.ip
        });
        next();
    }
    catch (error) {
        logger_1.authLogger.error('토큰 로그아웃 오류', error);
        res.status(403).json({
            success: false,
            error: {
                message: '로그아웃 처리 중 오류가 발생했습니다.',
                code: 'LOGOUT_ERROR'
            }
        });
        return;
    }
});
exports.logoutToken = logoutToken;
/**
 * 관리자 권한 확인 미들웨어
 */
const requireAdmin = (req, res, next) => {
    if (!req.enhancedUser || !req.enhancedUser.isAuthenticated) {
        res.status(401).json({
            success: false,
            error: {
                message: '인증이 필요합니다.',
                code: 'AUTH_REQUIRED'
            }
        });
        return;
    }
    if (req.enhancedUser.role !== 'admin') {
        logger_1.authLogger.warn('관리자 권한 접근 시도', {
            userId: req.enhancedUser.id,
            role: req.enhancedUser.role,
            path: req.originalUrl,
            ip: req.ip
        });
        res.status(403).json({
            success: false,
            error: {
                message: '관리자 권한이 필요합니다.',
                code: 'ADMIN_REQUIRED'
            }
        });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
/**
 * 토큰 갱신 미들웨어
 */
const refreshTokenIfNeeded = (req, res, next) => {
    if (!req.enhancedUser) {
        next();
        return;
    }
    const now = new Date();
    const tokenAge = now.getTime() - req.enhancedUser.tokenIssuedAt.getTime();
    const REFRESH_THRESHOLD = 6 * 60 * 60 * 1000; // 6시간
    if (tokenAge > REFRESH_THRESHOLD) {
        // 새 토큰 발급 필요
        res.setHeader('X-Token-Refresh-Needed', 'true');
        logger_1.authLogger.info('토큰 갱신 권장', {
            userId: req.enhancedUser.id,
            tokenAgeHours: tokenAge / (1000 * 60 * 60)
        });
    }
    next();
};
exports.refreshTokenIfNeeded = refreshTokenIfNeeded;
// 토큰 블랙리스트 정리를 위한 정기 작업 (5분마다)
setInterval(() => {
    TokenBlacklist.cleanup();
}, 5 * 60 * 1000);
