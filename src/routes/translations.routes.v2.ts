import { Router } from 'express';
import * as translationController from '../controllers/translation.controller';
import { authMiddleware, requireAuth } from '../middlewares/auth.middleware';
import { rateLimiter } from '../middlewares/rate-limit.middleware';
import {
    TranslationValidation,
    ValidationRules,
    createValidationMiddleware
} from '../middlewares/validation.middleware';

const router = Router();

// =============================================================================
// 번역 리소스 (RESTful)
// =============================================================================

/**
 * POST /api/v2/translations
 * 새로운 번역 생성
 */
router.post('/',
  authMiddleware, // 인증된 사용자만
  rateLimiter({ points: 50, duration: 60 }), // 분당 50회
  createValidationMiddleware(TranslationValidation.translateText()),
  translationController.createTranslation
);

/**
 * POST /api/v2/translations/batch
 * 배치 번역 생성
 */
router.post('/batch',
  authMiddleware,
  rateLimiter({ points: 10, duration: 60 }), // 분당 10회 (배치는 더 제한적)
  createValidationMiddleware(TranslationValidation.translateBatch()),
  translationController.createBatchTranslations
);

/**
 * GET /api/v2/translations/:id
 * 특정 번역 조회
 */
router.get('/:id',
  rateLimiter({ points: 100, duration: 60 }),
  createValidationMiddleware(ValidationRules.id()),
  translationController.getTranslation
);

/**
 * GET /api/v2/translations
 * 번역 히스토리 조회 (인증된 사용자의 번역 기록)
 */
router.get('/',
  authMiddleware,
  rateLimiter({ points: 50, duration: 60 }),
  createValidationMiddleware(ValidationRules.pagination()),
  translationController.getTranslationHistory
);

/**
 * DELETE /api/v2/translations/:id
 * 번역 기록 삭제 (본인 또는 관리자만)
 */
router.delete('/:id',
  authMiddleware,
  createValidationMiddleware(ValidationRules.id()),
  translationController.deleteTranslation
);

// =============================================================================
// 공개 번역 서비스 (제한된 기능)
// =============================================================================

/**
 * POST /api/v2/public-translations
 * 공개 번역 서비스 (인증 불필요, 더 제한적)
 */
router.post('/public',
  rateLimiter({ 
    points: 10, 
    duration: 60,
    keyGenerator: (req) => req.ip || 'unknown' // IP 기반 제한
  }),
  createValidationMiddleware([
    ...TranslationValidation.translateText(),
    // 공개 API는 더 엄격한 제한
    ValidationRules.textLength(500) // 최대 500자
  ]),
  translationController.createPublicTranslation
);

// =============================================================================
// 사용자별 번역 설정
// =============================================================================

/**
 * GET /api/v2/users/:userId/translation-preferences
 * 사용자 번역 설정 조회
 */
router.get('/users/:userId/preferences',
  authMiddleware,
  createValidationMiddleware([...ValidationRules.id('userId')]),
  translationController.getUserTranslationPreferences
);

/**
 * PUT /api/v2/users/:userId/translation-preferences
 * 사용자 번역 설정 업데이트
 */
router.put('/users/:userId/preferences',
  authMiddleware,
  createValidationMiddleware([
    ...ValidationRules.id('userId'),
    ...TranslationValidation.updatePreferences()
  ]),
  translationController.updateUserTranslationPreferences
);

// =============================================================================
// 번역 캐시 관리 (관리자용)
// =============================================================================

/**
 * GET /api/v2/translation-cache
 * 번역 캐시 상태 조회 (관리자만)
 */
router.get('/cache',
  authMiddleware,
  requireAuth(['admin']),
  translationController.getTranslationCacheStatus
);

/**
 * DELETE /api/v2/translation-cache
 * 번역 캐시 정리 (관리자만)
 */
router.delete('/cache',
  authMiddleware,
  requireAuth(['admin']),
  createValidationMiddleware(TranslationValidation.cleanupCache()),
  translationController.cleanupTranslationCache
);

/**
 * DELETE /api/v2/translation-cache/languages/:lang
 * 특정 언어 번역 캐시 삭제 (관리자만)
 */
router.delete('/cache/languages/:lang',
  authMiddleware,
  requireAuth(['admin']),
  createValidationMiddleware([ValidationRules.languageCode()]),
  translationController.clearLanguageTranslationCache
);

// =============================================================================
// 번역 통계 및 분석
// =============================================================================

/**
 * GET /api/v2/translation-statistics
 * 번역 서비스 통계 조회 (관리자만)
 */
router.get('/statistics',
  authMiddleware,
  requireAuth(['admin']),
  createValidationMiddleware(ValidationRules.dateRange()),
  translationController.getTranslationStatistics
);

/**
 * GET /api/v2/translation-statistics/languages
 * 언어별 번역 통계 조회 (관리자만)
 */
router.get('/statistics/languages',
  authMiddleware,
  requireAuth(['admin']),
  createValidationMiddleware(ValidationRules.dateRange()),
  translationController.getLanguageStatistics
);

export default router; 