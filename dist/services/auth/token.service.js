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
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma = new client_1.PrismaClient();
/**
 * 토큰 서비스 - JWT 토큰 생성, 검증, 관리를 담당
 */
class TokenService {
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
    generateAccessToken(userId, email, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = {
                userId,
                email,
                sessionId,
                type: 'access'
            };
            return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, {
                expiresIn: '15m' // 15분으로 고정
            });
        });
    }
    /**
     * 리프레시 토큰 생성
     */
    generateRefreshToken(userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = {
                userId,
                sessionId,
                type: 'refresh'
            };
            const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, {
                expiresIn: '7d' // 7일로 고정
            });
            // 토큰 해시 생성 및 저장
            const tokenHash = yield this.hashToken(token);
            yield prisma.refreshToken.create({
                data: {
                    userId,
                    tokenHash,
                    sessionId,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7일
                }
            });
            return token;
        });
    }
    /**
     * 토큰 검증 (미들웨어용)
     */
    verifyToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
                // 토큰이 블랙리스트에 있는지 확인
                if (decoded.jti) {
                    const isBlacklisted = yield this.isTokenBlacklisted(decoded.jti);
                    if (isBlacklisted) {
                        throw new Error('Blacklisted token');
                    }
                }
                return decoded;
            }
            catch (error) {
                throw error;
            }
        });
    }
    /**
     * 리프레시 토큰 검증 (컨트롤러용)
     */
    verifyRefreshToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenHash = yield this.hashToken(token);
            const storedToken = yield prisma.refreshToken.findFirst({
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
        });
    }
    /**
     * 리프레시 토큰 폐기
     */
    revokeRefreshToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenHash = yield this.hashToken(token);
            const result = yield prisma.refreshToken.updateMany({
                where: {
                    tokenHash
                },
                data: {
                    isRevoked: true,
                    updatedAt: new Date()
                }
            });
            return result.count > 0;
        });
    }
    /**
     * 사용자의 모든 리프레시 토큰 폐기
     */
    revokeAllUserTokens(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield prisma.refreshToken.updateMany({
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
        });
    }
    /**
     * 토큰 블랙리스트에 추가 (단순 토큰으로)
     */
    blacklistToken(token_1) {
        return __awaiter(this, arguments, void 0, function* (token, reason = '사용자 로그아웃') {
            try {
                const decoded = jsonwebtoken_1.default.decode(token);
                if (!decoded || !decoded.jti || !decoded.exp) {
                    throw new Error('유효하지 않은 토큰입니다.');
                }
                const jti = decoded.jti;
                const tokenHash = yield this.hashToken(token);
                const expiresAt = new Date(decoded.exp * 1000);
                yield prisma.tokenBlacklist.create({
                    data: {
                        jti,
                        tokenHash,
                        userId: decoded.userId || decoded.id,
                        reason,
                        expiresAt
                    }
                });
            }
            catch (error) {
                console.error('토큰 블랙리스트 추가 실패:', error);
                throw error;
            }
        });
    }
    /**
     * 토큰이 블랙리스트에 있는지 확인 (토큰으로)
     */
    isTokenBlacklisted(tokenOrJti) {
        return __awaiter(this, void 0, void 0, function* () {
            let jti = tokenOrJti;
            // 토큰인 경우 JTI 추출
            if (tokenOrJti.includes('.')) {
                try {
                    const decoded = jsonwebtoken_1.default.decode(tokenOrJti);
                    jti = decoded === null || decoded === void 0 ? void 0 : decoded.jti;
                }
                catch (error) {
                    return false;
                }
            }
            if (!jti)
                return false;
            const blacklistedToken = yield prisma.tokenBlacklist.findFirst({
                where: {
                    jti
                }
            });
            return !!blacklistedToken;
        });
    }
    /**
     * 만료된 블랙리스트 토큰 정리
     */
    cleanupBlacklistedTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield prisma.tokenBlacklist.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date()
                    }
                }
            });
            return result.count;
        });
    }
    /**
     * 토큰 해시 생성 (보안을 위해 원본 토큰 대신 해시 저장)
     */
    hashToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            return crypto_1.default.createHash('sha256').update(token).digest('hex');
        });
    }
}
exports.TokenService = TokenService;
exports.default = new TokenService();
