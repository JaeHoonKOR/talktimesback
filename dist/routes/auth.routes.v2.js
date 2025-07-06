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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_controller_v2_1 = require("../controllers/auth.controller.v2");
const enhanced_auth_middleware_1 = require("../middlewares/enhanced-auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const router = (0, express_1.Router)();
/**
 * 입력값 검증 규칙
 */
const loginValidation = [
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('유효한 이메일 주소를 입력해주세요.'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 6 })
        .withMessage('비밀번호는 최소 6자 이상이어야 합니다.'),
    validation_middleware_1.createValidationMiddleware
];
const refreshTokenValidation = [
    (0, express_validator_1.body)('refreshToken')
        .notEmpty()
        .withMessage('리프레시 토큰이 필요합니다.'),
    validation_middleware_1.createValidationMiddleware
];
/**
 * 인증 라우트 v2 (보안 강화)
 */
/**
 * @swagger
 * /api/v2/auth/login:
 *   post:
 *     tags: [Auth v2]
 *     summary: 사용자 로그인 (보안 강화)
 *     description: |
 *       향상된 보안 기능이 적용된 로그인
 *       - Rate Limiting (IP/이메일 기준)
 *       - 로그인 시도 추적
 *       - 계정 잠금 기능
 *       - 세션 관리
 *       - 토큰 블랙리스트
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               twoFactorCode:
 *                 type: string
 *                 description: "2단계 인증 코드 (활성화된 경우)"
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                         name:
 *                           type: string
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         expiresIn:
 *                           type: string
 *                           example: "1h"
 *                     session:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: 잘못된 입력값
 *       401:
 *         description: 인증 실패
 *       423:
 *         description: 계정 잠김
 *       429:
 *         description: Rate Limit 초과
 */
router.post('/login', loginValidation, auth_controller_v2_1.AuthControllerV2.login);
/**
 * @swagger
 * /api/v2/auth/refresh:
 *   post:
 *     tags: [Auth v2]
 *     summary: 토큰 갱신
 *     description: |
 *       리프레시 토큰을 사용하여 새로운 액세스 토큰 발급
 *       - 리프레시 토큰 검증
 *       - 토큰 로테이션 (새로운 리프레시 토큰 발급)
 *       - 보안 로깅
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: "유효한 리프레시 토큰"
 *     responses:
 *       200:
 *         description: 토큰 갱신 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         expiresIn:
 *                           type: string
 *                           example: "1h"
 *       400:
 *         description: 리프레시 토큰 누락
 *       401:
 *         description: 유효하지 않은 리프레시 토큰
 */
router.post('/refresh', refreshTokenValidation, auth_controller_v2_1.AuthControllerV2.refreshToken);
/**
 * @swagger
 * /api/v2/auth/logout:
 *   post:
 *     tags: [Auth v2]
 *     summary: 로그아웃 (보안 강화)
 *     description: |
 *       안전한 로그아웃 처리
 *       - 토큰 블랙리스트 추가
 *       - 세션 무효화
 *       - 리프레시 토큰 폐기
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 로그아웃 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "로그아웃되었습니다."
 *       500:
 *         description: 서버 오류
 */
router.post('/logout', auth_controller_v2_1.AuthControllerV2.logout);
/**
 * @swagger
 * /api/v2/auth/logout-all:
 *   post:
 *     tags: [Auth v2]
 *     summary: 모든 세션 로그아웃
 *     description: |
 *       사용자의 모든 기기에서 로그아웃
 *       - 모든 리프레시 토큰 폐기
 *       - 모든 활성 세션 무효화
 *       - 보안 이벤트 로깅
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 전체 로그아웃 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "모든 기기에서 로그아웃되었습니다."
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: 서버 오류
 */
router.post('/logout-all', enhanced_auth_middleware_1.enhancedAuthMiddleware, auth_controller_v2_1.AuthControllerV2.logoutAllSessions);
/**
 * @swagger
 * /api/v2/auth/me:
 *   get:
 *     tags: [Auth v2]
 *     summary: 현재 사용자 정보 조회
 *     description: |
 *       인증된 사용자의 정보를 반환
 *       - 토큰 검증
 *       - 사용자 정보 조회
 *       - 세션 활동 업데이트
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 사용자 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                         name:
 *                           type: string
 *                         lastActivity:
 *                           type: string
 *                           format: date-time
 *                         sessionId:
 *                           type: string
 *       401:
 *         description: 인증 실패
 */
router.get('/me', enhanced_auth_middleware_1.enhancedAuthMiddleware, (req, res) => {
    const user = req.enhancedUser;
    res.status(200).json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                lastActivity: user.lastActivity,
                sessionId: user.sessionId,
                isAuthenticated: user.isAuthenticated
            }
        }
    });
});
/**
 * @swagger
 * /api/v2/auth/sessions:
 *   get:
 *     tags: [Auth v2]
 *     summary: 활성 세션 목록 조회
 *     description: |
 *       사용자의 모든 활성 세션 정보를 반환
 *       - 세션 ID, 디바이스 정보, IP 주소 등
 *       - 마지막 활동 시간
 *       - 위치 정보 (가능한 경우)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 활성 세션 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           sessionId:
 *                             type: string
 *                           deviceInfo:
 *                             type: object
 *                           ipAddress:
 *                             type: string
 *                           lastActivity:
 *                             type: string
 *                             format: date-time
 *                           isCurrent:
 *                             type: boolean
 *       401:
 *         description: 인증 필요
 */
router.get('/sessions', enhanced_auth_middleware_1.enhancedAuthMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const userId = (_a = req.enhancedUser) === null || _a === void 0 ? void 0 : _a.id;
        const currentSessionId = (_b = req.enhancedUser) === null || _b === void 0 ? void 0 : _b.sessionId;
        const { DatabaseManager } = yield Promise.resolve().then(() => __importStar(require('../utils/database-manager')));
        const db = DatabaseManager.getInstance();
        const result = yield db.executeQuery(`
      SELECT session_id, device_info, ip_address, user_agent, last_activity, created_at
      FROM active_sessions
      WHERE user_id = $1 AND is_active = true
      ORDER BY last_activity DESC
    `, [userId]);
        const sessions = result.rows.map(row => ({
            sessionId: row.session_id,
            deviceInfo: row.device_info,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            lastActivity: row.last_activity,
            createdAt: row.created_at,
            isCurrent: row.session_id === currentSessionId
        }));
        res.status(200).json({
            success: true,
            data: {
                sessions,
                totalCount: sessions.length
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: '세션 목록 조회 중 오류가 발생했습니다.',
                code: 'SESSION_LIST_ERROR'
            }
        });
    }
}));
/**
 * @swagger
 * /api/v2/auth/sessions/{sessionId}:
 *   delete:
 *     tags: [Auth v2]
 *     summary: 특정 세션 종료
 *     description: |
 *       지정된 세션을 종료합니다
 *       - 세션 무효화
 *       - 해당 세션의 토큰 폐기
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 종료할 세션 ID
 *     responses:
 *       200:
 *         description: 세션 종료 성공
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 세션을 찾을 수 없음
 */
router.delete('/sessions/:sessionId', enhanced_auth_middleware_1.enhancedAuthMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.enhancedUser) === null || _a === void 0 ? void 0 : _a.id;
        const { sessionId } = req.params;
        const { DatabaseManager } = yield Promise.resolve().then(() => __importStar(require('../utils/database-manager')));
        const { TokenService } = yield Promise.resolve().then(() => __importStar(require('../services/auth/token-service')));
        const db = DatabaseManager.getInstance();
        // 세션 소유권 확인
        const sessionResult = yield db.executeQuery(`
      SELECT user_id FROM active_sessions 
      WHERE session_id = $1 AND is_active = true
    `, [sessionId]);
        if (sessionResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: {
                    message: '세션을 찾을 수 없습니다.',
                    code: 'SESSION_NOT_FOUND'
                }
            });
            return;
        }
        if (sessionResult.rows[0].user_id !== userId) {
            res.status(403).json({
                success: false,
                error: {
                    message: '세션에 대한 권한이 없습니다.',
                    code: 'SESSION_ACCESS_DENIED'
                }
            });
            return;
        }
        // 세션 종료
        yield Promise.all([
            TokenService.revokeTokens(userId, sessionId),
            db.executeQuery(`
        UPDATE active_sessions 
        SET is_active = false 
        WHERE session_id = $1
      `, [sessionId])
        ]);
        res.status(200).json({
            success: true,
            message: '세션이 종료되었습니다.'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: '세션 종료 중 오류가 발생했습니다.',
                code: 'SESSION_TERMINATION_ERROR'
            }
        });
    }
}));
exports.default = router;
