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
const translationController = __importStar(require("../controllers/translation.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const rate_limit_middleware_1 = require("../middlewares/rate-limit.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const router = (0, express_1.Router)();
// =============================================================================
// 번역 리소스 (RESTful)
// =============================================================================
/**
 * POST /api/v2/translations
 * 새로운 번역 생성
 */
router.post('/', auth_middleware_1.authMiddleware, // 인증된 사용자만
(0, rate_limit_middleware_1.rateLimiter)({ points: 50, duration: 60 }), // 분당 50회
(0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.TranslationValidation.translateText()), translationController.createTranslation);
/**
 * POST /api/v2/translations/batch
 * 배치 번역 생성
 */
router.post('/batch', auth_middleware_1.authMiddleware, (0, rate_limit_middleware_1.rateLimiter)({ points: 10, duration: 60 }), // 분당 10회 (배치는 더 제한적)
(0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.TranslationValidation.translateBatch()), translationController.createBatchTranslations);
/**
 * GET /api/v2/translations/:id
 * 특정 번역 조회
 */
router.get('/:id', (0, rate_limit_middleware_1.rateLimiter)({ points: 100, duration: 60 }), (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.ValidationRules.id()), translationController.getTranslation);
/**
 * GET /api/v2/translations
 * 번역 히스토리 조회 (인증된 사용자의 번역 기록)
 */
router.get('/', auth_middleware_1.authMiddleware, (0, rate_limit_middleware_1.rateLimiter)({ points: 50, duration: 60 }), (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.ValidationRules.pagination()), translationController.getTranslationHistory);
/**
 * DELETE /api/v2/translations/:id
 * 번역 기록 삭제 (본인 또는 관리자만)
 */
router.delete('/:id', auth_middleware_1.authMiddleware, (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.ValidationRules.id()), translationController.deleteTranslation);
// =============================================================================
// 공개 번역 서비스 (제한된 기능)
// =============================================================================
/**
 * POST /api/v2/public-translations
 * 공개 번역 서비스 (인증 불필요, 더 제한적)
 */
router.post('/public', (0, rate_limit_middleware_1.rateLimiter)({
    points: 10,
    duration: 60,
    keyGenerator: (req) => req.ip // IP 기반 제한
}), (0, validation_middleware_1.createValidationMiddleware)([
    ...validation_middleware_1.TranslationValidation.translateText(),
    // 공개 API는 더 엄격한 제한
    validation_middleware_1.ValidationRules.textLength(500) // 최대 500자
]), translationController.createPublicTranslation);
// =============================================================================
// 사용자별 번역 설정
// =============================================================================
/**
 * GET /api/v2/users/:userId/translation-preferences
 * 사용자 번역 설정 조회
 */
router.get('/users/:userId/preferences', auth_middleware_1.authMiddleware, (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.ValidationRules.id('userId')), translationController.getUserTranslationPreferences);
/**
 * PUT /api/v2/users/:userId/translation-preferences
 * 사용자 번역 설정 업데이트
 */
router.put('/users/:userId/preferences', auth_middleware_1.authMiddleware, (0, validation_middleware_1.createValidationMiddleware)([
    validation_middleware_1.ValidationRules.id('userId'),
    validation_middleware_1.TranslationValidation.updatePreferences()
]), translationController.updateUserTranslationPreferences);
// =============================================================================
// 번역 캐시 관리 (관리자용)
// =============================================================================
/**
 * GET /api/v2/translation-cache
 * 번역 캐시 상태 조회 (관리자만)
 */
router.get('/cache', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireAuth)(['admin']), translationController.getTranslationCacheStatus);
/**
 * DELETE /api/v2/translation-cache
 * 번역 캐시 정리 (관리자만)
 */
router.delete('/cache', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireAuth)(['admin']), (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.TranslationValidation.cleanupCache()), translationController.cleanupTranslationCache);
/**
 * DELETE /api/v2/translation-cache/languages/:lang
 * 특정 언어 번역 캐시 삭제 (관리자만)
 */
router.delete('/cache/languages/:lang', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireAuth)(['admin']), (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.ValidationRules.languageCode()), translationController.clearLanguageTranslationCache);
// =============================================================================
// 번역 통계 및 분석
// =============================================================================
/**
 * GET /api/v2/translation-statistics
 * 번역 서비스 통계 조회 (관리자만)
 */
router.get('/statistics', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireAuth)(['admin']), (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.ValidationRules.dateRange()), translationController.getTranslationStatistics);
/**
 * GET /api/v2/translation-statistics/languages
 * 언어별 번역 통계 조회 (관리자만)
 */
router.get('/statistics/languages', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireAuth)(['admin']), (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.ValidationRules.dateRange()), translationController.getLanguageStatistics);
exports.default = router;
