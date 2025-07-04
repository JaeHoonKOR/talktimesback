import { Router } from 'express';
import * as newsController from '../controllers/news.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// RSS 피드 소스 목록 조회
router.get('/sources', newsController.getRssSources);

// 최신 뉴스 수집 및 저장
router.post('/fetch', newsController.fetchAndSaveNews);

// 특정 카테고리의 뉴스 수집 및 저장
router.post('/fetch/:category', newsController.fetchAndSaveNewsByCategory);

// 뉴스 목록 조회 (필터링 옵션 적용)
router.get('/', newsController.getNews);

// 카테고리별 최신 뉴스 조회
router.get('/category/:category', newsController.getLatestNewsByCategory);

// 새로 추가된 API 엔드포인트
router.get('/latest', newsController.getLatestNews);
router.get('/by-category/:category', newsController.getNewsByCategory);
router.get('/personalized', authMiddleware, newsController.getPersonalizedNews);

// 키워드 기반 뉴스 검색 API 추가
router.post('/search', newsController.searchNewsByKeywords);

// 단일 뉴스 상세 정보 조회
router.get('/:id', newsController.getNewsById);

// AI를 이용한 뉴스 요약
router.get('/:id/summarize', newsController.summarizeNews);

// 처리되지 않은 뉴스 일괄 요약 처리
router.post('/batch-process', newsController.batchProcessNews);

// 뉴스 통계 정보 조회
router.get('/stats/all', newsController.getNewsStats);

export default router; 