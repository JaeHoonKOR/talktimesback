import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { login, signup } from '../controllers/auth.controller';

const router = Router();
const prisma = new PrismaClient();

// =============================================================================
// ⚠️ DEPRECATED API v1 - 이 API는 곧 제거될 예정입니다.
// 새로운 개발에는 /api/v2/users 를 사용해주세요.
// =============================================================================

// Deprecated 경고를 위한 미들웨어
const deprecatedWarning = (req: any, res: any, next: any) => {
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('X-API-Deprecated-Version', 'v1');
  res.setHeader('X-API-Replacement', '/api/v2/users');
  res.setHeader('X-API-Sunset-Date', '2025-06-01');
  
  console.warn(`[DEPRECATED] ${req.method} ${req.originalUrl} - Use /api/v2/users instead`);
  next();
};

// 모든 라우트에 deprecated 경고 적용
router.use(deprecatedWarning);

router.post('/signup', signup);
router.post('/login', login);

// 테스트 라우트
router.get('/test', (req, res) => {
  console.log('테스트 라우트 호출됨');
  res.json({ message: '인증 라우터가 정상적으로 작동중입니다.' });
});

// 카카오 로그인 시작
router.get('/kakao', passport.authenticate('kakao'));

// 카카오 로그인 콜백
router.get(
  '/kakao/callback',
  (req, res, next) => {
    // 에러 파라미터 체크
    if (req.query.error === 'access_denied') {
      // 사용자가 취소한 경우 프론트엔드의 이전 페이지로 리다이렉트
      return res.redirect(`${process.env.FRONTEND_URL}/login?canceled=true`);
    }
    // 정상적인 경우 인증 진행
    passport.authenticate('kakao', { session: false })(req, res, next);
  },
  (req, res) => {
    try {
      const user = req.user as any;
      
      // JWT 토큰 생성
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      // 프론트엔드로 리다이렉트 (토큰과 함께)
      res.redirect(`${process.env.FRONTEND_URL}/auth/social?token=${token}`);
    } catch (error) {
      console.error('Kakao callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }
  }
);

// 구글 로그인 시작
router.get('/google', (req, res) => {
  const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    client_id: process.env.GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };

  const qs = new URLSearchParams(options);
  const url = `${googleAuthUrl}?${qs.toString()}`;
  res.redirect(url);
});

// 구글 로그인 콜백
router.get('/google/callback', async (req, res) => {
  const code = req.query.code as string;
  
  try {
    // 액세스 토큰 얻기
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenResponse.data;

    // 사용자 정보 가져오기
    const userInfoResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const { email, name, picture } = userInfoResponse.data;

    // 이메일로 기존 사용자 찾기
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // 새 사용자 생성
      user = await prisma.user.create({
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
  } catch (error) {
    console.error('구글 로그인 에러:', error);
    res.redirect(`${process.env.FRONTEND_URL}?loginError=true&provider=google`);
  }
});

export default router; 