import { Router } from 'express';
import { param } from 'express-validator';
import * as newsController from '../controllers/news.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    NewsValidation,
    ValidationRules,
    createValidationMiddleware
} from '../middlewares/validation.middleware';

const router = Router();

// =============================================================================
// ⚠️ DEPRECATED API v1 - 이 API는 곧 제거될 예정입니다.
// 새로운 개발에는 /api/v2/news 를 사용해주세요.
// =============================================================================

// Deprecated 경고를 위한 미들웨어
const deprecatedWarning = (req: any, res: any, next: any) => {
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('X-API-Deprecated-Version', 'v1');
  res.setHeader('X-API-Replacement', '/api/v2/news');
  res.setHeader('X-API-Sunset-Date', '2025-06-01');
  
  console.warn(`[DEPRECATED] ${req.method} ${req.originalUrl} - Use /api/v2/news instead`);
  next();
};

// 모든 라우트에 deprecated 경고 적용
router.use(deprecatedWarning);

// =============================================================================
// 뉴스 리소스 관리 (RESTful)
// =============================================================================

/**
 * GET /api/news
 * 뉴스 목록 조회 (필터링, 정렬, 페이지네이션 지원)
 */
router.get('/', 
  createValidationMiddleware(NewsValidation.getNewsList()),
  newsController.getNews
);

/**
 * GET /api/news/search
 * 뉴스 검색 (키워드 기반)
 */
router.get('/search',
  createValidationMiddleware(NewsValidation.searchNews()),
  newsController.searchNewsByKeywords
);

/**
 * GET /api/news/latest
 * 최신 뉴스 목록 조회
 */
router.get('/latest',
  createValidationMiddleware(ValidationRules.pagination()),
  newsController.getLatestNews
);

/**
 * GET /api/news/personalized
 * 개인화된 뉴스 목록 조회 (인증 필요)
 */
router.get('/personalized',
  authMiddleware,
  createValidationMiddleware(ValidationRules.pagination()),
  newsController.getPersonalizedNews
);

/**
 * GET /api/news/categories/:category
 * 카테고리별 뉴스 목록 조회
 */
router.get('/categories/:category',
  createValidationMiddleware(NewsValidation.getNewsByCategory()),
  newsController.getNewsByCategory
);

/**
 * GET /api/news/:id
 * 특정 뉴스 상세 정보 조회
 */
router.get('/:id',
  createValidationMiddleware(NewsValidation.getNewsById()),
  newsController.getNewsById
);

/**
 * GET /api/news/:id/summary
 * 뉴스 AI 요약 조회
 */
router.get('/:id/summary',
  createValidationMiddleware(NewsValidation.getNewsById()),
  newsController.summarizeNews
);

// =============================================================================
// 뉴스 관리 작업 (관리자용)
// =============================================================================

/**
 * POST /api/news/fetch
 * 최신 뉴스 수집 및 저장
 */
router.post('/fetch',
  authMiddleware, // 관리자 권한 필요
  newsController.fetchAndSaveNews
);

/**
 * POST /api/news/categories/:category/fetch
 * 특정 카테고리의 뉴스 수집 및 저장
 */
router.post('/categories/:category/fetch',
  authMiddleware, // 관리자 권한 필요
  createValidationMiddleware([
    param('category')
      .notEmpty()
      .withMessage('카테고리는 필수입니다.')
      .isIn(['politics', 'economy', 'society', 'culture', 'world', 'sports', 'entertainment', 'tech'])
      .withMessage('유효한 카테고리가 아닙니다.')
  ]),
  newsController.fetchAndSaveNewsByCategory
);

/**
 * PUT /api/news/batch-process
 * 처리되지 않은 뉴스 일괄 처리
 */
router.put('/batch-process',
  authMiddleware, // 관리자 권한 필요
  newsController.batchProcessNews
);

// =============================================================================
// 뉴스 통계 및 메타데이터
// =============================================================================

/**
 * GET /api/news/sources
 * RSS 피드 소스 목록 조회
 */
router.get('/sources',
  newsController.getRssSources
);

/**
 * GET /api/news/stats
 * 뉴스 통계 정보 조회
 */
router.get('/stats',
  newsController.getNewsStats
);

export default router; 