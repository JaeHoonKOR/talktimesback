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
const newsController = __importStar(require("../controllers/news.controller"));
const newsControllerV2 = __importStar(require("../controllers/news.controller.v2"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const rate_limit_middleware_1 = require("../middlewares/rate-limit.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const router = (0, express_1.Router)();
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
router.get('/', (0, rate_limit_middleware_1.rateLimiter)({ points: 100, duration: 60 }), // 분당 100회
(0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.NewsValidation.getNewsList()), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { personalized } = req.query;
    // 개인화 요청인 경우 인증 필요
    if (personalized === 'true') {
        return (0, auth_middleware_1.authMiddleware)(req, res, next);
    }
    next();
}), newsControllerV2.getNewsUnified // 통합된 컨트롤러 함수
);
/**
 * GET /api/v2/news/:id
 * 특정 뉴스 상세 정보 조회
 */
router.get('/:id', (0, rate_limit_middleware_1.rateLimiter)({ points: 200, duration: 60 }), // 분당 200회
(0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.NewsValidation.getNewsById()), newsController.getNewsById);
/**
 * PUT /api/v2/news/:id
 * 뉴스 정보 업데이트 (관리자만)
 */
router.put('/:id', auth_middleware_1.authMiddleware, auth_middleware_1.requireAdmin, (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.NewsValidation.updateNews()), newsController.updateNews);
/**
 * DELETE /api/v2/news/:id
 * 뉴스 삭제 (관리자만)
 */
router.delete('/:id', auth_middleware_1.authMiddleware, auth_middleware_1.requireAdmin, (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.NewsValidation.getNewsById()), newsController.deleteNews);
// =============================================================================
// 뉴스 서브 리소스
// =============================================================================
/**
 * GET /api/v2/news/:id/summary
 * 뉴스 AI 요약 조회
 */
router.get('/:id/summary', (0, rate_limit_middleware_1.rateLimiter)({ points: 50, duration: 60 }), // 분당 50회
(0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.NewsValidation.getNewsById()), newsControllerV2.getNewsSummary);
/**
 * POST /api/v2/news/:id/summary
 * 뉴스 AI 요약 생성 (관리자만)
 */
router.post('/:id/summary', auth_middleware_1.authMiddleware, auth_middleware_1.requireAdmin, (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.NewsValidation.getNewsById()), newsController.createNewsSummary);
/**
 * GET /api/v2/news/:id/translations/:lang
 * 특정 언어로 번역된 뉴스 조회
 */
router.get('/:id/translations/:lang', (0, rate_limit_middleware_1.rateLimiter)({ points: 100, duration: 60 }), (0, validation_middleware_1.createValidationMiddleware)([
    ...validation_middleware_1.NewsValidation.getNewsById(),
    validation_middleware_1.ValidationRules.languageCode()
]), newsControllerV2.getNewsTranslation);
// =============================================================================
// 뉴스 컬렉션 관리 (관리자용)
// =============================================================================
/**
 * POST /api/v2/news-collections
 * 새로운 뉴스 수집 작업 시작 (관리자만)
 */
router.post('/collections', auth_middleware_1.authMiddleware, auth_middleware_1.requireAdmin, (0, rate_limit_middleware_1.rateLimiter)({ points: 10, duration: 3600 }), // 시간당 10회
(0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.NewsValidation.createNewsCollection()), newsController.createNewsCollection);
/**
 * GET /api/v2/news-collections
 * 뉴스 수집 작업 상태 조회 (관리자만)
 */
router.get('/collections', auth_middleware_1.authMiddleware, auth_middleware_1.requireAdmin, (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.ValidationRules.pagination()), newsController.getNewsCollections);
/**
 * PUT /api/v2/news-collections/:id
 * 특정 뉴스 수집 작업 업데이트 (관리자만)
 */
router.put('/collections/:id', auth_middleware_1.authMiddleware, auth_middleware_1.requireAdmin, (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.NewsValidation.updateNewsCollection()), newsController.updateNewsCollection);
// =============================================================================
// 메타데이터 및 통계
// =============================================================================
/**
 * GET /api/v2/news/metadata/sources
 * RSS 피드 소스 목록 조회
 */
router.get('/metadata/sources', (0, rate_limit_middleware_1.rateLimiter)({ points: 20, duration: 60 }), newsControllerV2.getNewsSources);
/**
 * GET /api/v2/news/metadata/categories
 * 뉴스 카테고리 목록 조회
 */
router.get('/metadata/categories', (0, rate_limit_middleware_1.rateLimiter)({ points: 20, duration: 60 }), newsControllerV2.getNewsCategories);
/**
 * GET /api/v2/news/statistics
 * 뉴스 통계 정보 조회
 */
router.get('/statistics', (0, rate_limit_middleware_1.rateLimiter)({ points: 10, duration: 60 }), newsControllerV2.getNewsStatistics);
exports.default = router;
