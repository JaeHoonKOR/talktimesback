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
exports.logoutFromAllDevices = exports.getSessions = exports.refreshToken = exports.logout = exports.login = exports.signup = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
// 새로운 보안 서비스들 import
const security_logger_service_1 = __importStar(require("../services/auth/security-logger.service"));
const session_service_1 = __importDefault(require("../services/auth/session.service"));
const token_service_1 = __importDefault(require("../services/auth/token.service"));
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET; // 환경 변수 검증으로 존재 보장됨
const signup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, name } = req.body;
        // 이메일 중복 체크
        const existingUser = yield prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.REGISTRATION_FAILED, security_logger_service_1.SecurityEventSeverity.MEDIUM, 'Duplicate email registration attempt', null, req.ip, req.headers['user-agent'], { email });
            return res.status(400).json({ message: '이미 존재하는 이메일입니다.' });
        }
        // 비밀번호 해싱 (보안 강화를 위해 12 라운드 사용)
        const hashedPassword = yield bcrypt_1.default.hash(password, 12);
        // 사용자 생성
        const user = yield prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name
            }
        });
        // 세션 생성
        const sessionId = yield session_service_1.default.createSession(user.id.toString(), req);
        // JWT 토큰 생성 (세션 ID 포함)
        const accessToken = yield token_service_1.default.generateAccessToken(user.id.toString(), user.email || '', sessionId);
        const refreshToken = yield token_service_1.default.generateRefreshToken(user.id.toString(), sessionId);
        // 성공 로그
        yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.REGISTRATION_SUCCESS, security_logger_service_1.SecurityEventSeverity.LOW, 'User registered successfully', user.id.toString(), req.ip, req.headers['user-agent']);
        res.status(201).json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    }
    catch (error) {
        console.error('회원가입 에러:', error);
        yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.SYSTEM_ERROR, security_logger_service_1.SecurityEventSeverity.CRITICAL, 'Registration system error', null, req.ip, req.headers['user-agent'], { error: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error' });
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
});
exports.signup = signup;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        // 사용자 찾기
        const user = yield prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.LOGIN_FAILED, security_logger_service_1.SecurityEventSeverity.MEDIUM, 'Login attempt with non-existent email', null, req.ip, req.headers['user-agent'], { email });
            return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
        }
        // 비밀번호 확인
        if (!user.password) {
            yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.LOGIN_FAILED, security_logger_service_1.SecurityEventSeverity.HIGH, 'Login attempt for user without password', user.id.toString(), req.ip, req.headers['user-agent']);
            return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.LOGIN_FAILED, security_logger_service_1.SecurityEventSeverity.HIGH, 'Login attempt with wrong password', user.id.toString(), req.ip, req.headers['user-agent']);
            return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
        }
        // 세션 생성
        const sessionId = yield session_service_1.default.createSession(user.id.toString(), req);
        // JWT 토큰 생성 (세션 ID 포함)
        const accessToken = yield token_service_1.default.generateAccessToken(user.id.toString(), user.email || '', sessionId);
        const refreshToken = yield token_service_1.default.generateRefreshToken(user.id.toString(), sessionId);
        // 성공 로그
        yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.LOGIN_SUCCESS, security_logger_service_1.SecurityEventSeverity.LOW, 'User logged in successfully', user.id.toString(), req.ip, req.headers['user-agent']);
        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    }
    catch (error) {
        console.error('로그인 에러:', error);
        yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.SYSTEM_ERROR, security_logger_service_1.SecurityEventSeverity.CRITICAL, 'Login system error', null, req.ip, req.headers['user-agent'], { error: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error' });
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
});
exports.login = login;
/**
 * 로그아웃 - 토큰 블랙리스트 처리 및 세션 종료
 */
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader === null || authHeader === void 0 ? void 0 : authHeader.split(' ')[1];
        if (!token) {
            return res.status(400).json({ message: '토큰이 필요합니다.' });
        }
        // 토큰 블랙리스트 처리
        yield token_service_1.default.blacklistToken(token);
        // 세션 종료
        if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.sessionId) {
            yield session_service_1.default.terminateSession(req.user.sessionId);
        }
        // 로그아웃 로그
        yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.LOGOUT_SUCCESS, security_logger_service_1.SecurityEventSeverity.LOW, 'User logged out successfully', ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || null, req.ip, req.headers['user-agent']);
        res.json({ message: '로그아웃되었습니다.' });
    }
    catch (error) {
        console.error('로그아웃 에러:', error);
        yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.SYSTEM_ERROR, security_logger_service_1.SecurityEventSeverity.CRITICAL, 'Logout system error', ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id) || null, req.ip, req.headers['user-agent'], { error: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error' });
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
});
exports.logout = logout;
/**
 * 리프레시 토큰으로 새 액세스 토큰 발급
 */
const refreshToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: '리프레시 토큰이 필요합니다.' });
        }
        // 리프레시 토큰 검증
        const decoded = yield token_service_1.default.verifyRefreshToken(refreshToken);
        // 사용자 조회
        const user = yield prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }
        // 새 액세스 토큰 생성
        const newAccessToken = yield token_service_1.default.generateAccessToken(user.id.toString(), user.email || '', decoded.sessionId);
        res.json({ accessToken: newAccessToken });
    }
    catch (error) {
        console.error('토큰 갱신 에러:', error);
        yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.TOKEN_REFRESH_FAILED, security_logger_service_1.SecurityEventSeverity.MEDIUM, 'Token refresh failed', null, req.ip, req.headers['user-agent'], { error: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error' });
        res.status(401).json({ message: '유효하지 않은 리프레시 토큰입니다.' });
    }
});
exports.refreshToken = refreshToken;
/**
 * 사용자의 모든 활성 세션 조회
 */
const getSessions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        const sessions = yield session_service_1.default.getUserActiveSessions(req.user.id);
        res.json({ sessions });
    }
    catch (error) {
        console.error('세션 조회 에러:', error);
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
});
exports.getSessions = getSessions;
/**
 * 모든 기기에서 로그아웃 (현재 세션 제외)
 */
const logoutFromAllDevices = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || !((_b = req.user) === null || _b === void 0 ? void 0 : _b.sessionId)) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        const terminatedCount = yield session_service_1.default.terminateOtherSessions(req.user.id, req.user.sessionId);
        // 로그
        yield security_logger_service_1.default.logSecurityEvent(security_logger_service_1.SecurityEventType.LOGOUT_SUCCESS, security_logger_service_1.SecurityEventSeverity.MEDIUM, 'User logged out from all devices', req.user.id, req.ip, req.headers['user-agent'], { terminatedSessions: terminatedCount });
        res.json({
            message: '다른 모든 기기에서 로그아웃되었습니다.',
            terminatedSessions: terminatedCount
        });
    }
    catch (error) {
        console.error('전체 로그아웃 에러:', error);
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
});
exports.logoutFromAllDevices = logoutFromAllDevices;
