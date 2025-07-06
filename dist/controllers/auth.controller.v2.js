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
exports.AuthControllerV2 = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const blacklist_service_1 = require("../services/auth/blacklist-service");
const token_service_1 = require("../services/auth/token-service");
const database_manager_1 = require("../utils/database-manager");
const logger_1 = require("../utils/logger");
/**
 * 강화된 인증 컨트롤러 v2
 */
class AuthControllerV2 {
    /**
     * 사용자 로그인 (보안 강화)
     */
    static login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            try {
                const { email, password } = req.body;
                // 입력값 검증
                if (!email || !password) {
                    yield AuthControllerV2.recordLoginAttempt({
                        identifier: clientIp,
                        identifierType: 'ip',
                        attemptType: 'login',
                        success: false,
                        ipAddress: clientIp,
                        userAgent,
                        errorMessage: '이메일과 비밀번호가 필요합니다.'
                    });
                    res.status(400).json({
                        success: false,
                        error: {
                            message: '이메일과 비밀번호가 필요합니다.',
                            code: 'MISSING_CREDENTIALS'
                        }
                    });
                    return;
                }
                // Rate Limiting 체크 (이메일 기준)
                const recentFailures = yield AuthControllerV2.getRecentFailedAttempts(email, 'email');
                if (recentFailures >= 5) {
                    yield AuthControllerV2.recordLoginAttempt({
                        identifier: email,
                        identifierType: 'email',
                        attemptType: 'login',
                        success: false,
                        ipAddress: clientIp,
                        userAgent,
                        errorMessage: '너무 많은 로그인 실패로 일시적으로 차단됨'
                    });
                    res.status(429).json({
                        success: false,
                        error: {
                            message: '너무 많은 로그인 시도로 계정이 일시적으로 잠겼습니다. 15분 후 다시 시도해주세요.',
                            code: 'ACCOUNT_TEMPORARILY_LOCKED'
                        }
                    });
                    return;
                }
                // 사용자 조회 및 보안 설정 확인
                const db = database_manager_1.DatabaseManager.getInstance();
                const userResult = yield db.executeQuery(`
        SELECT u.*, uss.account_locked_until, uss.failed_login_count, uss.two_factor_enabled
        FROM users u
        LEFT JOIN user_security_settings uss ON u.id = uss.user_id
        WHERE u.email = $1
      `, [email]);
                if (userResult.rows.length === 0) {
                    yield AuthControllerV2.recordLoginAttempt({
                        identifier: email,
                        identifierType: 'email',
                        attemptType: 'login',
                        success: false,
                        ipAddress: clientIp,
                        userAgent,
                        errorMessage: '존재하지 않는 이메일'
                    });
                    // 보안을 위해 동일한 응답 메시지 사용
                    res.status(401).json({
                        success: false,
                        error: {
                            message: '이메일 또는 비밀번호가 올바르지 않습니다.',
                            code: 'INVALID_CREDENTIALS'
                        }
                    });
                    return;
                }
                const user = userResult.rows[0];
                // 계정 잠금 확인
                if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
                    yield AuthControllerV2.recordLoginAttempt({
                        identifier: email,
                        identifierType: 'email',
                        attemptType: 'login',
                        success: false,
                        userId: user.id,
                        ipAddress: clientIp,
                        userAgent,
                        errorMessage: '계정이 잠겨있음'
                    });
                    res.status(423).json({
                        success: false,
                        error: {
                            message: '계정이 잠겼습니다. 관리자에게 문의하세요.',
                            code: 'ACCOUNT_LOCKED'
                        }
                    });
                    return;
                }
                // 비밀번호 검증
                const isValidPassword = yield bcrypt_1.default.compare(password, user.password);
                if (!isValidPassword) {
                    // 실패 횟수 증가
                    yield AuthControllerV2.incrementFailedLoginCount(user.id);
                    yield AuthControllerV2.recordLoginAttempt({
                        identifier: email,
                        identifierType: 'email',
                        attemptType: 'login',
                        success: false,
                        userId: user.id,
                        ipAddress: clientIp,
                        userAgent,
                        errorMessage: '잘못된 비밀번호'
                    });
                    res.status(401).json({
                        success: false,
                        error: {
                            message: '이메일 또는 비밀번호가 올바르지 않습니다.',
                            code: 'INVALID_CREDENTIALS'
                        }
                    });
                    return;
                }
                // 로그인 성공 - 토큰 생성
                const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                const accessToken = token_service_1.TokenService.generateAccessToken({
                    id: user.id,
                    email: user.email,
                    role: user.role
                }, sessionId);
                const refreshToken = yield token_service_1.TokenService.generateRefreshToken(user.id, sessionId);
                // 활성 세션 저장
                yield AuthControllerV2.createActiveSession({
                    sessionId,
                    userId: user.id,
                    ipAddress: clientIp,
                    userAgent,
                    deviceInfo: AuthControllerV2.parseDeviceInfo(userAgent)
                });
                // 실패 횟수 리셋
                yield AuthControllerV2.resetFailedLoginCount(user.id);
                // 성공 로그 기록
                yield AuthControllerV2.recordLoginAttempt({
                    identifier: email,
                    identifierType: 'email',
                    attemptType: 'login',
                    success: true,
                    userId: user.id,
                    ipAddress: clientIp,
                    userAgent
                });
                const responseTime = Date.now() - startTime;
                logger_1.authLogger.info('로그인 성공', {
                    userId: user.id,
                    email: user.email,
                    sessionId,
                    ip: clientIp,
                    responseTime
                });
                res.status(200).json({
                    success: true,
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            role: user.role,
                            name: user.name
                        },
                        tokens: {
                            accessToken,
                            refreshToken,
                            expiresIn: '1h'
                        },
                        session: {
                            id: sessionId,
                            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간
                        }
                    }
                });
            }
            catch (error) {
                logger_1.authLogger.error('로그인 처리 중 오류', error);
                res.status(500).json({
                    success: false,
                    error: {
                        message: '로그인 처리 중 오류가 발생했습니다.',
                        code: 'LOGIN_ERROR'
                    }
                });
            }
        });
    }
    /**
     * 토큰 갱신
     */
    static refreshToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { refreshToken } = req.body;
                if (!refreshToken) {
                    res.status(400).json({
                        success: false,
                        error: {
                            message: '리프레시 토큰이 필요합니다.',
                            code: 'REFRESH_TOKEN_REQUIRED'
                        }
                    });
                    return;
                }
                const result = yield token_service_1.TokenService.refreshAccessToken(refreshToken);
                logger_1.authLogger.info('토큰 갱신 성공', {
                    userId: result.user.id
                });
                res.status(200).json({
                    success: true,
                    data: {
                        user: result.user,
                        tokens: {
                            accessToken: result.accessToken,
                            refreshToken: result.newRefreshToken,
                            expiresIn: '1h'
                        }
                    }
                });
            }
            catch (error) {
                logger_1.authLogger.warn('토큰 갱신 실패', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
                res.status(401).json({
                    success: false,
                    error: {
                        message: error.message,
                        code: 'TOKEN_REFRESH_FAILED'
                    }
                });
            }
        });
    }
    /**
     * 로그아웃 (보안 강화)
     */
    static logout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const authHeader = req.headers.authorization;
                const token = authHeader === null || authHeader === void 0 ? void 0 : authHeader.split(' ')[1];
                if (token) {
                    // 토큰을 블랙리스트에 추가
                    const decoded = token_service_1.TokenService.verifyToken(token);
                    const tokenHash = blacklist_service_1.BlacklistService.generateTokenHash(token);
                    yield blacklist_service_1.BlacklistService.addToBlacklist(decoded.jti, tokenHash, decoded.id, '사용자 로그아웃', new Date(decoded.exp * 1000));
                    // 해당 세션의 모든 토큰 폐기
                    yield token_service_1.TokenService.revokeTokens(decoded.id, decoded.sessionId);
                    // 활성 세션 비활성화
                    yield AuthControllerV2.deactivateSession(decoded.sessionId);
                    logger_1.authLogger.info('로그아웃 완료', {
                        userId: decoded.id,
                        sessionId: decoded.sessionId
                    });
                }
                res.status(200).json({
                    success: true,
                    message: '로그아웃되었습니다.'
                });
            }
            catch (error) {
                logger_1.authLogger.error('로그아웃 처리 중 오류', error);
                res.status(500).json({
                    success: false,
                    error: {
                        message: '로그아웃 처리 중 오류가 발생했습니다.',
                        code: 'LOGOUT_ERROR'
                    }
                });
            }
        });
    }
    /**
     * 모든 세션 로그아웃
     */
    static logoutAllSessions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.enhancedUser) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    res.status(401).json({
                        success: false,
                        error: {
                            message: '인증이 필요합니다.',
                            code: 'AUTHENTICATION_REQUIRED'
                        }
                    });
                    return;
                }
                // 사용자의 모든 토큰 폐기
                yield token_service_1.TokenService.revokeTokens(userId);
                // 모든 활성 세션 비활성화
                yield AuthControllerV2.deactivateAllUserSessions(userId);
                logger_1.authLogger.info('모든 세션 로그아웃', {
                    userId
                });
                res.status(200).json({
                    success: true,
                    message: '모든 기기에서 로그아웃되었습니다.'
                });
            }
            catch (error) {
                logger_1.authLogger.error('전체 로그아웃 처리 중 오류', error);
                res.status(500).json({
                    success: false,
                    error: {
                        message: '로그아웃 처리 중 오류가 발생했습니다.',
                        code: 'LOGOUT_ALL_ERROR'
                    }
                });
            }
        });
    }
    // === Helper Methods ===
    /**
     * 로그인 시도 기록
     */
    static recordLoginAttempt(attempt) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const db = database_manager_1.DatabaseManager.getInstance();
                yield db.executeQuery(`
        INSERT INTO login_attempts (
          identifier, identifier_type, attempt_type, success, user_id, 
          ip_address, user_agent, error_message, attempted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
                    attempt.identifier,
                    attempt.identifierType,
                    attempt.attemptType,
                    attempt.success,
                    attempt.userId || null,
                    attempt.ipAddress || null,
                    attempt.userAgent || null,
                    attempt.errorMessage || null
                ]);
            }
            catch (error) {
                logger_1.authLogger.error('로그인 시도 기록 실패', error);
            }
        });
    }
    /**
     * 최근 실패한 로그인 시도 횟수 조회
     */
    static getRecentFailedAttempts(identifier, type) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const db = database_manager_1.DatabaseManager.getInstance();
                const result = yield db.executeQuery(`
        SELECT COUNT(*) as failed_count
        FROM login_attempts
        WHERE identifier = $1 
        AND identifier_type = $2 
        AND success = false 
        AND attempted_at > NOW() - INTERVAL '15 minutes'
      `, [identifier, type]);
                return parseInt(result.rows[0].failed_count) || 0;
            }
            catch (error) {
                logger_1.authLogger.error('실패 시도 횟수 조회 실패', error);
                return 0;
            }
        });
    }
    /**
     * 실패한 로그인 횟수 증가
     */
    static incrementFailedLoginCount(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const db = database_manager_1.DatabaseManager.getInstance();
                yield db.executeQuery(`
        UPDATE user_security_settings 
        SET failed_login_count = failed_login_count + 1
        WHERE user_id = $1
      `, [userId]);
            }
            catch (error) {
                logger_1.authLogger.error('실패 로그인 횟수 증가 실패', error);
            }
        });
    }
    /**
     * 실패한 로그인 횟수 리셋
     */
    static resetFailedLoginCount(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const db = database_manager_1.DatabaseManager.getInstance();
                yield db.executeQuery(`
        UPDATE user_security_settings 
        SET failed_login_count = 0
        WHERE user_id = $1
      `, [userId]);
            }
            catch (error) {
                logger_1.authLogger.error('실패 로그인 횟수 리셋 실패', error);
            }
        });
    }
    /**
     * 활성 세션 생성
     */
    static createActiveSession(session) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const db = database_manager_1.DatabaseManager.getInstance();
                yield db.executeQuery(`
        INSERT INTO active_sessions (
          session_id, user_id, device_info, ip_address, user_agent, 
          last_activity, expires_at, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '24 hours', true, NOW())
      `, [
                    session.sessionId,
                    session.userId,
                    JSON.stringify(session.deviceInfo),
                    session.ipAddress,
                    session.userAgent
                ]);
            }
            catch (error) {
                logger_1.authLogger.error('활성 세션 생성 실패', error);
            }
        });
    }
    /**
     * 세션 비활성화
     */
    static deactivateSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const db = database_manager_1.DatabaseManager.getInstance();
                yield db.executeQuery(`
        UPDATE active_sessions 
        SET is_active = false 
        WHERE session_id = $1
      `, [sessionId]);
            }
            catch (error) {
                logger_1.authLogger.error('세션 비활성화 실패', error);
            }
        });
    }
    /**
     * 사용자의 모든 세션 비활성화
     */
    static deactivateAllUserSessions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const db = database_manager_1.DatabaseManager.getInstance();
                yield db.executeQuery(`
        UPDATE active_sessions 
        SET is_active = false 
        WHERE user_id = $1
      `, [userId]);
            }
            catch (error) {
                logger_1.authLogger.error('전체 세션 비활성화 실패', error);
            }
        });
    }
    /**
     * 디바이스 정보 파싱
     */
    static parseDeviceInfo(userAgent) {
        return {
            userAgent,
            browser: 'unknown',
            os: 'unknown',
            device: 'unknown'
        };
    }
}
exports.AuthControllerV2 = AuthControllerV2;
