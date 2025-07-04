import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { rateLimiter } from '../middlewares/rate-limit.middleware';
import {
    UserValidation,
    createValidationMiddleware
} from '../middlewares/validation.middleware';

const router = Router();

// =============================================================================
// 사용자 리소스 (RESTful)
// =============================================================================

/**
 * POST /api/v2/users
 * 새로운 사용자 생성 (회원가입)
 */
router.post('/',
  rateLimiter({ points: 5, duration: 3600 }), // 시간당 5회 (스팸 방지)
  createValidationMiddleware(UserValidation.createUser()),
  authController.signup
);

/**
 * POST /api/v2/users/sessions
 * 새로운 세션 생성 (로그인)
 */
router.post('/sessions',
  rateLimiter({ points: 10, duration: 900 }), // 15분당 10회
  createValidationMiddleware(UserValidation.login()),
  authController.login
);

/**
 * DELETE /api/v2/users/sessions
 * 현재 세션 삭제 (로그아웃)
 */
router.delete('/sessions',
  authMiddleware,
  (req, res) => {
    res.json({ message: '로그아웃 되었습니다.' });
  }
);

/**
 * GET /api/v2/users/sessions/current
 * 현재 세션 정보 조회
 */
router.get('/sessions/current',
  authMiddleware,
  (req, res) => {
    res.json({ user: req.user });
  }
);

export default router;
