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
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const passport_1 = __importDefault(require("passport"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// =============================================================================
// ⚠️ DEPRECATED API v1 - 이 API는 곧 제거될 예정입니다.
// 새로운 개발에는 /api/v2/users 를 사용해주세요.
// =============================================================================
// Deprecated 경고를 위한 미들웨어
const deprecatedWarning = (req, res, next) => {
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Deprecated-Version', 'v1');
    res.setHeader('X-API-Replacement', '/api/v2/users');
    res.setHeader('X-API-Sunset-Date', '2025-06-01');
    console.warn(`[DEPRECATED] ${req.method} ${req.originalUrl} - Use /api/v2/users instead`);
    next();
};
// 모든 라우트에 deprecated 경고 적용
router.use(deprecatedWarning);
// 기본 인증 엔드포인트
router.post('/signup', auth_controller_1.signup);
router.post('/login', auth_controller_1.login);
// 새로운 보안 강화 엔드포인트들
router.post('/logout', auth_middleware_1.authMiddleware, auth_controller_1.logout);
router.post('/refresh-token', auth_controller_1.refreshToken);
router.get('/sessions', auth_middleware_1.authMiddleware, auth_controller_1.getSessions);
router.post('/logout-all-devices', auth_middleware_1.authMiddleware, auth_controller_1.logoutFromAllDevices);
// 테스트 라우트
router.get('/test', (req, res) => {
    console.log('테스트 라우트 호출됨');
    res.json({ message: '인증 라우터가 정상적으로 작동중입니다.' });
});
// 카카오 로그인 시작
router.get('/kakao', passport_1.default.authenticate('kakao'));
// 카카오 로그인 콜백
router.get('/kakao/callback', (req, res, next) => {
    // 에러 파라미터 체크
    if (req.query.error === 'access_denied') {
        // 사용자가 취소한 경우 프론트엔드의 이전 페이지로 리다이렉트
        return res.redirect(`${process.env.FRONTEND_URL}/login?canceled=true`);
    }
    // 정상적인 경우 인증 진행
    passport_1.default.authenticate('kakao', { session: false })(req, res, next);
}, (req, res) => {
    try {
        const user = req.user;
        // JWT 토큰 생성
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role || 'user'
        }, process.env.JWT_SECRET, { expiresIn: '24h' });
        // 프론트엔드로 리다이렉트 (토큰과 함께)
        res.redirect(`${process.env.FRONTEND_URL}/auth/social?token=${token}`);
    }
    catch (error) {
        console.error('Kakao callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }
});
// 구글 로그인 시작
router.get('/google', (req, res) => {
    const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        access_type: 'offline',
        response_type: 'code',
        prompt: 'consent',
        scope: 'openid email profile'
    };
    const qs = new URLSearchParams(options);
    const url = `${googleAuthUrl}?${qs.toString()}`;
    res.redirect(url);
});
// 구글 로그인 콜백
router.get('/google/callback', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const code = req.query.code;
    try {
        // 액세스 토큰 얻기
        const tokenResponse = yield axios_1.default.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code',
        });
        const { access_token } = tokenResponse.data;
        // 사용자 정보 가져오기
        const userInfoResponse = yield axios_1.default.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        const { email, name, picture } = userInfoResponse.data;
        // 이메일로 기존 사용자 찾기
        let user = yield prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            // 새 사용자 생성
            user = yield prisma.user.create({
                data: {
                    email,
                    name: name || email.split('@')[0],
                    profileImage: picture,
                    provider: 'google',
                },
            });
        }
        // 프론트엔드로 리다이렉트
        res.redirect(`${process.env.FRONTEND_URL}?loginSuccess=true&provider=google`);
    }
    catch (error) {
        console.error('구글 로그인 에러:', error);
        res.redirect(`${process.env.FRONTEND_URL}?loginError=true&provider=google`);
    }
}));
exports.default = router;
