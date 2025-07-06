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
exports.SecurityLoggerService = exports.SecurityEventType = exports.SecurityEventSeverity = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * 보안 이벤트 심각도 수준
 */
var SecurityEventSeverity;
(function (SecurityEventSeverity) {
    SecurityEventSeverity["LOW"] = "low";
    SecurityEventSeverity["MEDIUM"] = "medium";
    SecurityEventSeverity["HIGH"] = "high";
    SecurityEventSeverity["CRITICAL"] = "critical";
})(SecurityEventSeverity || (exports.SecurityEventSeverity = SecurityEventSeverity = {}));
/**
 * 보안 이벤트 유형
 */
var SecurityEventType;
(function (SecurityEventType) {
    SecurityEventType["LOGIN_SUCCESS"] = "login_success";
    SecurityEventType["LOGIN_FAILED"] = "login_failed";
    SecurityEventType["LOGOUT_SUCCESS"] = "logout_success";
    SecurityEventType["AUTHENTICATION_SUCCESS"] = "authentication_success";
    SecurityEventType["AUTHENTICATION_FAILED"] = "authentication_failed";
    SecurityEventType["REGISTRATION_SUCCESS"] = "registration_success";
    SecurityEventType["REGISTRATION_FAILED"] = "registration_failed";
    SecurityEventType["SESSION_EXPIRED"] = "session_expired";
    SecurityEventType["TOKEN_REFRESH_FAILED"] = "token_refresh_failed";
    SecurityEventType["SYSTEM_ERROR"] = "system_error";
    SecurityEventType["LOGIN_FAILURE"] = "login_failure";
    SecurityEventType["LOGOUT"] = "logout";
    SecurityEventType["PASSWORD_CHANGE"] = "password_change";
    SecurityEventType["PASSWORD_RESET"] = "password_reset";
    SecurityEventType["ACCOUNT_LOCKOUT"] = "account_lockout";
    SecurityEventType["SUSPICIOUS_LOGIN"] = "suspicious_login";
    SecurityEventType["TOKEN_REFRESH"] = "token_refresh";
    SecurityEventType["TOKEN_REVOKED"] = "token_revoked";
    SecurityEventType["PERMISSION_CHANGE"] = "permission_change";
    SecurityEventType["MULTIPLE_LOGIN_ATTEMPTS"] = "multiple_login_attempts";
    SecurityEventType["BRUTE_FORCE_ATTEMPT"] = "brute_force_attempt";
    SecurityEventType["API_ABUSE"] = "api_abuse";
    SecurityEventType["SECURITY_SETTING_CHANGE"] = "security_setting_change";
})(SecurityEventType || (exports.SecurityEventType = SecurityEventType = {}));
/**
 * 보안 이벤트 로깅 서비스 - 보안 관련 이벤트 기록 및 관리
 */
class SecurityLoggerService {
    /**
     * 보안 이벤트 로그 기록 (메인 메서드)
     */
    logSecurityEvent(eventType, severity, description, userId, ipAddress, userAgent, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma.authEventLog.create({
                    data: {
                        eventType,
                        userId,
                        ipAddress,
                        userAgent,
                        details: metadata ? JSON.stringify(metadata) : undefined
                    }
                });
            }
            catch (error) {
                console.error('보안 이벤트 로깅 실패:', error);
                // 로깅 실패는 애플리케이션 동작에 영향을 주지 않도록 에러를 던지지 않음
            }
        });
    }
    /**
     * 보안 이벤트 로그 기록 (Request 객체 사용)
     */
    logEvent(eventType, severity, description, userId, req, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ipAddress = req ? this.getClientIp(req) : null;
                const userAgent = (req === null || req === void 0 ? void 0 : req.headers['user-agent']) || null;
                yield this.logSecurityEvent(eventType, severity, description, userId, ipAddress, userAgent, metadata);
            }
            catch (error) {
                console.error('보안 이벤트 로깅 실패:', error);
                // 로깅 실패는 애플리케이션 동작에 영향을 주지 않도록 에러를 던지지 않음
            }
        });
    }
    /**
     * 로그인 성공 이벤트 로깅
     */
    logLoginSuccess(userId, req) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.LOGIN_SUCCESS, SecurityEventSeverity.LOW, '사용자 로그인 성공', userId, req, { method: 'standard' });
        });
    }
    /**
     * 로그인 실패 이벤트 로깅
     */
    logLoginFailure(userId, req, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.LOGIN_FAILURE, SecurityEventSeverity.MEDIUM, '사용자 로그인 실패', userId, req, { reason });
        });
    }
    /**
     * 로그아웃 이벤트 로깅
     */
    logLogout(userId, req) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.LOGOUT, SecurityEventSeverity.LOW, '사용자 로그아웃', userId, req);
        });
    }
    /**
     * 비밀번호 변경 이벤트 로깅
     */
    logPasswordChange(userId, req) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.PASSWORD_CHANGE, SecurityEventSeverity.MEDIUM, '비밀번호 변경', userId, req);
        });
    }
    /**
     * 비밀번호 재설정 이벤트 로깅
     */
    logPasswordReset(userId, req) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.PASSWORD_RESET, SecurityEventSeverity.MEDIUM, '비밀번호 재설정', userId, req);
        });
    }
    /**
     * 계정 잠금 이벤트 로깅
     */
    logAccountLockout(userId, req, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.ACCOUNT_LOCKOUT, SecurityEventSeverity.HIGH, '계정 잠금', userId, req, { reason });
        });
    }
    /**
     * 의심스러운 로그인 이벤트 로깅
     */
    logSuspiciousLogin(userId, req, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.SUSPICIOUS_LOGIN, SecurityEventSeverity.HIGH, '의심스러운 로그인 시도', userId, req, { reason });
        });
    }
    /**
     * 토큰 갱신 이벤트 로깅
     */
    logTokenRefresh(userId, req) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.TOKEN_REFRESH, SecurityEventSeverity.LOW, '토큰 갱신', userId, req);
        });
    }
    /**
     * 토큰 폐기 이벤트 로깅
     */
    logTokenRevoked(userId, req, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.TOKEN_REVOKED, SecurityEventSeverity.MEDIUM, '토큰 폐기', userId, req, { reason });
        });
    }
    /**
     * 다중 로그인 시도 이벤트 로깅
     */
    logMultipleLoginAttempts(identifier, req, count) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.MULTIPLE_LOGIN_ATTEMPTS, SecurityEventSeverity.HIGH, '다중 로그인 시도', undefined, req, { identifier, count });
        });
    }
    /**
     * 브루트 포스 공격 시도 이벤트 로깅
     */
    logBruteForceAttempt(identifier, req) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.BRUTE_FORCE_ATTEMPT, SecurityEventSeverity.CRITICAL, '브루트 포스 공격 시도', undefined, req, { identifier });
        });
    }
    /**
     * API 남용 이벤트 로깅
     */
    logApiAbuse(userId, req, endpoint, count) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.API_ABUSE, SecurityEventSeverity.HIGH, 'API 남용', userId, req, { endpoint, count });
        });
    }
    /**
     * 사용자 보안 설정 변경 이벤트 로깅
     */
    logSecuritySettingChange(userId, req, setting) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logEvent(SecurityEventType.SECURITY_SETTING_CHANGE, SecurityEventSeverity.MEDIUM, '보안 설정 변경', userId, req, { setting });
        });
    }
    /**
     * 사용자별 보안 이벤트 로그 조회
     */
    getUserSecurityLogs(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = 50) {
            return prisma.authEventLog.findMany({
                where: {
                    userId
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: limit
            });
        });
    }
    /**
     * 이벤트 유형별 보안 이벤트 로그 조회
     */
    getSecurityLogsByEventType(eventType_1) {
        return __awaiter(this, arguments, void 0, function* (eventType, limit = 50) {
            return prisma.authEventLog.findMany({
                where: {
                    eventType
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: limit
            });
        });
    }
    /**
     * 클라이언트 IP 주소 추출
     */
    getClientIp(req) {
        const forwardedFor = req.headers['x-forwarded-for'];
        if (forwardedFor) {
            return Array.isArray(forwardedFor)
                ? forwardedFor[0]
                : forwardedFor.split(',')[0].trim();
        }
        return req.socket.remoteAddress || '';
    }
}
exports.SecurityLoggerService = SecurityLoggerService;
exports.default = new SecurityLoggerService();
