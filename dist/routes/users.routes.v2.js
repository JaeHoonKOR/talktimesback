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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController = __importStar(require("../controllers/auth.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const rate_limit_middleware_1 = require("../middlewares/rate-limit.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const router = (0, express_1.Router)();
// =============================================================================
// 사용자 리소스 (RESTful)
// =============================================================================
/**
 * POST /api/v2/users
 * 새로운 사용자 생성 (회원가입)
 */
router.post('/', (0, rate_limit_middleware_1.rateLimiter)({ points: 5, duration: 3600 }), // 시간당 5회 (스팸 방지)
(0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.UserValidation.createUser()), authController.signup);
/**
 * POST /api/v2/users/sessions
 * 새로운 세션 생성 (로그인)
 */
router.post('/sessions', (0, rate_limit_middleware_1.rateLimiter)({ points: 10, duration: 900 }), // 15분당 10회
(0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.UserValidation.login()), authController.login);
/**
 * DELETE /api/v2/users/sessions
 * 현재 세션 삭제 (로그아웃)
 */
router.delete('/sessions', auth_middleware_1.authMiddleware, (req, res) => {
    res.json({ message: '로그아웃 되었습니다.' });
});
/**
 * GET /api/v2/users/sessions/current
 * 현재 세션 정보 조회
 */
router.get('/sessions/current', auth_middleware_1.authMiddleware, (req, res) => {
    res.json({ user: req.user });
});
exports.default = router;
