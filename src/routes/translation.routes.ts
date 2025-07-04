import { Request, Response, Router } from 'express';
import {
    cleanupCache,
    clearAllCache,
    clearLanguageCache,
    getCacheStatus,
    translateBatch,
    translateText
} from '../controllers/translation.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
    TranslationValidation,
    UserValidation,
    ValidationRules,
    createValidationMiddleware
} from '../middlewares/validation.middleware';
import { prisma } from '../server';
import { TranslationCacheManager } from '../services/translation/cache-manager';
import { TranslationService } from '../services/translation/translation-service';
import { ResponseHelper } from '../utils/response.helper';

const router = Router();
const translationService = new TranslationService();
const cacheManager = new TranslationCacheManager();

// =============================================================================
// ⚠️ DEPRECATED API v1 - 이 API는 곧 제거될 예정입니다.
// 새로운 개발에는 /api/v2/translations 를 사용해주세요.
// =============================================================================

// Deprecated 경고를 위한 미들웨어
const deprecatedWarning = (req: any, res: any, next: any) => {
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('X-API-Deprecated-Version', 'v1');
  res.setHeader('X-API-Replacement', '/api/v2/translations');
  res.setHeader('X-API-Sunset-Date', '2025-06-01');
  
  console.warn(`[DEPRECATED] ${req.method} ${req.originalUrl} - Use /api/v2/translations instead`);
  next();
};

// 모든 라우트에 deprecated 경고 적용
router.use(deprecatedWarning);

// =============================================================================
// 번역 서비스 (RESTful)
// =============================================================================

/**
 * POST /api/translation/text
 * 텍스트 번역 (인증 필요)
 */
router.post('/text', 
  authenticateToken,
  createValidationMiddleware(TranslationValidation.translateText()),
  translateText
);

/**
 * POST /api/translation/batch
 * 배치 번역 (인증 필요)
 */
router.post('/batch', 
  authenticateToken,
  createValidationMiddleware(TranslationValidation.translateBatch()),
  translateBatch
);

/**
 * POST /api/translation/public/text
 * 공개 텍스트 번역 (인증 불필요)
 */
router.post('/public/text', 
  createValidationMiddleware(TranslationValidation.translateText()),
  async (req: Request, res: Response) => {
    try {
      const { text, targetLang = 'ko' } = req.body;

      const result = await translationService.translateText(text, targetLang);
      
      if (!result) {
        return ResponseHelper.externalServiceError(res, '번역 처리 중 오류가 발생했습니다.');
      }

      return ResponseHelper.success(res, result);
    } catch (error) {
      console.error('공개 번역 API 오류:', error);
      return ResponseHelper.internalServerError(res, '번역 중 오류가 발생했습니다.');
    }
  }
);

/**
 * POST /api/translation/public/batch
 * 공개 배치 번역 (인증 불필요)
 */
router.post('/public/batch',
  createValidationMiddleware(TranslationValidation.translateBatch()),
  async (req: Request, res: Response) => {
    try {
      const { texts, targetLang = 'ko' } = req.body;

      const results = await Promise.all(
        texts.map((text: string) => translationService.translateText(text, targetLang))
      );

      const successCount = results.filter(r => r !== null).length;
      const failureCount = results.length - successCount;

      return ResponseHelper.success(res, {
        translations: results.filter(r => r !== null),
        totalCount: results.length,
        successCount,
        failureCount
      });
    } catch (error) {
      console.error('공개 배치 번역 API 오류:', error);
      return ResponseHelper.internalServerError(res, '배치 번역 중 오류가 발생했습니다.');
    }
  }
);

// =============================================================================
// 뉴스 번역 서비스
// =============================================================================

/**
 * GET /api/translation/news/:id
 * 뉴스 번역 조회
 */
router.get('/news/:id', 
  createValidationMiddleware(TranslationValidation.translateNews()),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { lang = 'ko' } = req.query;

      const translatedNews = await translationService.translateNews(id, lang as string);

      if (!translatedNews) {
        return ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
      }

      return ResponseHelper.success(res, translatedNews);
    } catch (error) {
      console.error('뉴스 번역 API 오류:', error);
      return ResponseHelper.internalServerError(res, '번역 중 오류가 발생했습니다.');
    }
  }
);

// =============================================================================
// 사용자 설정 관리
// =============================================================================

/**
 * PUT /api/translation/user/language
 * 사용자 언어 설정 업데이트
 */
router.put('/user/language', 
  authenticateToken,
  createValidationMiddleware(UserValidation.updateLanguage()),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { language } = req.body;

      if (!userId) {
        return ResponseHelper.unauthorized(res);
      }

      const updatedUser = await prisma.user.update({
        where: { id: parseInt(userId) },
        data: { language },
        select: {
          id: true,
          name: true,
          language: true
        }
      });

      return ResponseHelper.success(res, updatedUser);
    } catch (error) {
      console.error('언어 설정 업데이트 오류:', error);
      return ResponseHelper.internalServerError(res, '언어 설정 업데이트 중 오류가 발생했습니다.');
    }
  }
);

/**
 * GET /api/translation/user/language
 * 사용자 언어 설정 조회
 */
router.get('/user/language',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return ResponseHelper.unauthorized(res);
      }

      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: {
          id: true,
          name: true,
          language: true
        }
      });

      if (!user) {
        return ResponseHelper.notFound(res, '사용자를 찾을 수 없습니다.');
      }

      return ResponseHelper.success(res, user);
    } catch (error) {
      console.error('언어 설정 조회 오류:', error);
      return ResponseHelper.internalServerError(res, '언어 설정 조회 중 오류가 발생했습니다.');
    }
  }
);

// =============================================================================
// 번역 캐시 관리 (관리자용)
// =============================================================================

/**
 * GET /api/translation/cache/status
 * 번역 캐시 상태 조회
 */
router.get('/cache/status', 
  authenticateToken, 
  getCacheStatus
);

/**
 * POST /api/translation/cache/cleanup
 * 번역 캐시 정리
 */
router.post('/cache/cleanup', 
  authenticateToken, 
  cleanupCache
);

/**
 * DELETE /api/translation/cache/languages/:targetLang
 * 특정 언어의 번역 캐시 삭제
 */
router.delete('/cache/languages/:targetLang', 
  authenticateToken,
  createValidationMiddleware([
    ValidationRules.id('targetLang')
  ]),
  clearLanguageCache
);

/**
 * DELETE /api/translation/cache
 * 번역 캐시 전체 삭제
 */
router.delete('/cache', 
  authenticateToken, 
  clearAllCache
);

// =============================================================================
// 번역 통계 및 관리
// =============================================================================

/**
 * GET /api/translation/stats
 * 번역 통계 조회 (관리자용)
 */
router.get('/stats', 
  authenticateToken, 
  async (req: Request, res: Response) => {
    try {
      const stats = await cacheManager.getTranslationStats();
      const cacheStatus = await cacheManager.getCacheStatus();

      return ResponseHelper.success(res, {
        ...stats,
        cacheStatus
      });
    } catch (error) {
      console.error('번역 통계 조회 오류:', error);
      return ResponseHelper.internalServerError(res, '통계 조회 중 오류가 발생했습니다.');
    }
  }
);

export default router; 