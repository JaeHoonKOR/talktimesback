import { Router } from 'express';
import * as newsController from '../controllers/news.controller';
import * as newsControllerV2 from '../controllers/news.controller.v2';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { rateLimiter } from '../middlewares/rate-limit.middleware';
import {
    NewsValidation,
    ValidationRules,
    createValidationMiddleware
} from '../middlewares/validation.middleware';

const router = Router();

// =============================================================================
// 뉴스 리소스 (RESTful)
// =============================================================================

/**
 * @swagger
 * /api/v2/news:
 *   get:
 *     summary: 뉴스 목록 조회 (RESTful)
 *     description: 검색, 필터링, 개인화, 페이지네이션을 지원하는 통합 뉴스 목록 조회
 *     tags: [News v2]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 검색어
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: 카테고리 필터
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [latest, popular, relevance]
 *           default: latest
 *         description: 정렬 방식
 *       - in: query
 *         name: personalized
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 개인화 뉴스 여부 (인증 필요)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 페이지 당 항목 수
 *     responses:
 *       200:
 *         description: 성공적으로 뉴스 목록을 조회
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
 *                     news:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/NewsItem'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 잘못된 요청
 *       429:
 *         description: 요청 제한 초과
 *       500:
 *         description: 서버 오류
 */
router.get('/', 
  rateLimiter({ points: 100, duration: 60 }), // 분당 100회
  createValidationMiddleware(NewsValidation.getNewsList()),
  async (req, res, next) => {
    const { personalized } = req.query;
    
    // 개인화 요청인 경우 인증 필요
    if (personalized === 'true') {
      return authMiddleware(req, res, next);
    }
    
    next();
  },
  newsControllerV2.getNewsUnified // 통합된 컨트롤러 함수
);

/**
 * GET /api/v2/news/:id
 * 특정 뉴스 상세 정보 조회
 */
router.get('/:id',
  rateLimiter({ points: 200, duration: 60 }), // 분당 200회
  createValidationMiddleware(NewsValidation.getNewsById()),
  newsController.getNewsById
);

/**
 * PUT /api/v2/news/:id
 * 뉴스 정보 업데이트 (관리자만)
 */
router.put('/:id',
  authMiddleware,
  requireAdmin,
  createValidationMiddleware(NewsValidation.updateNews()),
  newsController.updateNews
);

/**
 * DELETE /api/v2/news/:id
 * 뉴스 삭제 (관리자만)
 */
router.delete('/:id',
  authMiddleware,
  requireAdmin,
  createValidationMiddleware(NewsValidation.getNewsById()),
  newsController.deleteNews
);

// =============================================================================
// 뉴스 서브 리소스
// =============================================================================

/**
 * GET /api/v2/news/:id/summary
 * 뉴스 AI 요약 조회
 */
router.get('/:id/summary',
  rateLimiter({ points: 50, duration: 60 }), // 분당 50회
  createValidationMiddleware(NewsValidation.getNewsById()),
  newsControllerV2.getNewsSummary
);

/**
 * POST /api/v2/news/:id/summary
 * 뉴스 AI 요약 생성 (관리자만)
 */
router.post('/:id/summary',
  authMiddleware,
  requireAdmin,
  createValidationMiddleware(NewsValidation.getNewsById()),
  newsController.createNewsSummary
);

/**
 * GET /api/v2/news/:id/translations/:lang
 * 특정 언어로 번역된 뉴스 조회
 */
router.get('/:id/translations/:lang',
  rateLimiter({ points: 100, duration: 60 }),
  createValidationMiddleware([
    ...NewsValidation.getNewsById(),
    ValidationRules.languageCode()
  ]),
  newsControllerV2.getNewsTranslation
);

// =============================================================================
// 뉴스 컬렉션 관리 (관리자용)
// =============================================================================

/**
 * POST /api/v2/news-collections
 * 새로운 뉴스 수집 작업 시작 (관리자만)
 */
router.post('/collections',
  authMiddleware,
  requireAdmin,
  rateLimiter({ points: 10, duration: 3600 }), // 시간당 10회
  createValidationMiddleware(NewsValidation.createNewsCollection()),
  newsController.createNewsCollection
);

/**
 * GET /api/v2/news-collections
 * 뉴스 수집 작업 상태 조회 (관리자만)
 */
router.get('/collections',
  authMiddleware,
  requireAdmin,
  createValidationMiddleware(ValidationRules.pagination()),
  newsController.getNewsCollections
);

/**
 * PUT /api/v2/news-collections/:id
 * 특정 뉴스 수집 작업 업데이트 (관리자만)
 */
router.put('/collections/:id',
  authMiddleware,
  requireAdmin,
  createValidationMiddleware(NewsValidation.updateNewsCollection()),
  newsController.updateNewsCollection
);

// =============================================================================
// 메타데이터 및 통계
// =============================================================================

/**
 * GET /api/v2/news/metadata/sources
 * RSS 피드 소스 목록 조회
 */
router.get('/metadata/sources',
  rateLimiter({ points: 20, duration: 60 }),
  newsControllerV2.getNewsSources
);

/**
 * GET /api/v2/news/metadata/categories
 * 뉴스 카테고리 목록 조회
 */
router.get('/metadata/categories',
  rateLimiter({ points: 20, duration: 60 }),
  newsControllerV2.getNewsCategories
);

/**
 * GET /api/v2/news/statistics
 * 뉴스 통계 정보 조회
 */
router.get('/statistics',
  rateLimiter({ points: 10, duration: 60 }),
  newsControllerV2.getNewsStatistics
);

export default router; 