"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.UserRole = exports.authenticateToken = exports.authMiddleware = void 0;
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.requireSystem = requireSystem;
const server_1 = require("../server");
// 새로운 보안 서비스들 import
const security_logger_service_1 = __importStar(require("../services/auth/security-logger.service"));
const session_service_1 = __importDefault(require("../services/auth/session.service"));
const token_service_1 = __importDefault(require("../services/auth/token.service"));
/**
 * 사용자 인증 미들웨어 (보안 강화 버전)
 */
const authMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.AUTHENTICATION_FAILED, security_logger_service_1.SecurityEventSeverity.MEDIUM, 'Authorization header missing or invalid', null, req.ip, req.headers['user-agent']);
            return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
        }
        const token = authHeader.split(' ')[1];
        try {
            // 1. 토큰 블랙리스트 확인
            const isBlacklisted = yield token_service_1.default.isTokenBlacklisted(token);
            if (isBlacklisted) {
                yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.AUTHENTICATION_FAILED, security_logger_service_1.SecurityEventSeverity.HIGH, 'Blacklisted token used', null, req.ip, req.headers['user-agent']);
                return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
            }
            // 2. 토큰 검증
            const decoded = yield token_service_1.default.verifyToken(token);
            // 3. 사용자 정보 조회
            const user = yield server_1.prisma.user.findUnique({
                where: { id: decoded.id }
            });
            if (!user) {
                yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.AUTHENTICATION_FAILED, security_logger_service_1.SecurityEventSeverity.HIGH, 'Token valid but user not found', decoded.id, req.ip, req.headers['user-agent']);
                return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
            }
            // 4. 세션 확인 (세션 ID가 있는 경우)
            const sessionId = decoded.sessionId;
            if (sessionId) {
                const isSessionActive = yield session_service_1.default.isSessionActive(sessionId);
                if (!isSessionActive) {
                    yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.SESSION_EXPIRED, security_logger_service_1.SecurityEventSeverity.MEDIUM, 'Session expired or inactive', decoded.id, req.ip, req.headers['user-agent']);
                    return res.status(401).json({ success: false, message: '세션이 만료되었습니다.' });
                }
                // 세션 활동 업데이트
                yield session_service_1.default.updateSessionActivity(sessionId);
            }
            // 5. 사용자 정보 설정
            req.user = {
                id: user.id.toString(),
                email: user.email || '',
                role: 'user',
                sessionId: sessionId
            };
            // 6. 성공 로그
            yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.AUTHENTICATION_SUCCESS, security_logger_service_1.SecurityEventSeverity.LOW, 'User authenticated successfully', decoded.id, req.ip, req.headers['user-agent']);
            next();
        }
        catch (jwtError) {
            console.error('JWT 검증 오류:', jwtError);
            yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.AUTHENTICATION_FAILED, security_logger_service_1.SecurityEventSeverity.HIGH, 'JWT verification failed', null, req.ip, req.headers['user-agent'], { error: jwtError.message });
            return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
        }
    }
    catch (error) {
        console.error('인증 미들웨어 오류:', error);
        yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.SYSTEM_ERROR, security_logger_service_1.SecurityEventSeverity.CRITICAL, 'Authentication middleware error', null, req.ip, req.headers['user-agent'], { error: error.message });
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});
exports.authMiddleware = authMiddleware;
// 기존 코드와의 호환성을 위한 alias
exports.authenticateToken = exports.authMiddleware;
/**
 * 사용자 역할 열거형
 */
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
    UserRole["SYSTEM"] = "system";
})(UserRole || (exports.UserRole = UserRole = {}));
/**
 * 역할 기반 접근 제어 미들웨어 팩토리
 * @param allowedRoles 허용된 역할 배열
 * @returns Express 미들웨어 함수
 */
function requireAuth(allowedRoles = []) {
    return (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: '인증이 필요합니다.',
                    code: 'AUTHENTICATION_REQUIRED'
                });
            }
            // 역할 확인 (관리자는 모든 권한 보유)
            if (allowedRoles.length > 0) {
                const userRole = user.role || 'user';
                if (userRole !== 'admin' && !allowedRoles.includes(userRole)) {
                    return res.status(403).json({
                        success: false,
                        message: '접근 권한이 없습니다.',
                        code: 'INSUFFICIENT_PERMISSIONS',
                        requiredRoles: allowedRoles,
                        userRole: userRole
                    });
                }
            }
            next();
        }
        catch (error) {
            console.error('Role-based access control error:', error);
            return res.status(500).json({
                success: false,
                message: '권한 확인 중 오류가 발생했습니다.',
                code: 'AUTHORIZATION_ERROR'
            });
        }
    };
}
/**
 * 관리자 권한 확인 미들웨어
 */
function requireAdmin(req, res, next) {
    return requireAuth([UserRole.ADMIN])(req, res, next);
}
/**
 * 시스템 권한 확인 미들웨어
 */
function requireSystem(req, res, next) {
    return requireAuth([UserRole.SYSTEM])(req, res, next);
}
