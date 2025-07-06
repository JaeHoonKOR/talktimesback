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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const translation_controller_1 = require("../controllers/translation.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const server_1 = require("../server");
const cache_manager_1 = require("../services/translation/cache-manager");
const translation_service_1 = require("../services/translation/translation-service");
const response_helper_1 = require("../utils/response.helper");
const router = (0, express_1.Router)();
const translationService = new translation_service_1.TranslationService();
const cacheManager = new cache_manager_1.TranslationCacheManager();
// =============================================================================
// ⚠️ DEPRECATED API v1 - 이 API는 곧 제거될 예정입니다.
// 새로운 개발에는 /api/v2/translations 를 사용해주세요.
// =============================================================================
// Deprecated 경고를 위한 미들웨어
const deprecatedWarning = (req, res, next) => {
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
router.post('/text', auth_middleware_1.authenticateToken, (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.TranslationValidation.translateText()), translation_controller_1.translateText);
/**
 * POST /api/translation/batch
 * 배치 번역 (인증 필요)
 */
router.post('/batch', auth_middleware_1.authenticateToken, (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.TranslationValidation.translateBatch()), translation_controller_1.translateBatch);
/**
 * POST /api/translation/public/text
 * 공개 텍스트 번역 (인증 불필요)
 */
router.post('/public/text', (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.TranslationValidation.translateText()), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { text, targetLang = 'ko' } = req.body;
        const result = yield translationService.translateText(text, targetLang);
        if (!result) {
            return response_helper_1.ResponseHelper.externalServiceError(res, '번역 처리 중 오류가 발생했습니다.');
        }
        return response_helper_1.ResponseHelper.success(res, result);
    }
    catch (error) {
        console.error('공개 번역 API 오류:', error);
        return response_helper_1.ResponseHelper.internalServerError(res, '번역 중 오류가 발생했습니다.');
    }
}));
/**
 * POST /api/translation/public/batch
 * 공개 배치 번역 (인증 불필요)
 */
router.post('/public/batch', (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.TranslationValidation.translateBatch()), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { texts, targetLang = 'ko' } = req.body;
        const results = yield Promise.all(texts.map((text) => translationService.translateText(text, targetLang)));
        const successCount = results.filter(r => r !== null).length;
        const failureCount = results.length - successCount;
        return response_helper_1.ResponseHelper.success(res, {
            translations: results.filter(r => r !== null),
            totalCount: results.length,
            successCount,
            failureCount
        });
    }
    catch (error) {
        console.error('공개 배치 번역 API 오류:', error);
        return response_helper_1.ResponseHelper.internalServerError(res, '배치 번역 중 오류가 발생했습니다.');
    }
}));
// =============================================================================
// 뉴스 번역 서비스
// =============================================================================
/**
 * GET /api/translation/news/:id
 * 뉴스 번역 조회
 */
router.get('/news/:id', (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.TranslationValidation.translateNews()), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { lang = 'ko' } = req.query;
        const translatedNews = yield translationService.translateNews(id, lang);
        if (!translatedNews) {
            return response_helper_1.ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
        }
        return response_helper_1.ResponseHelper.success(res, translatedNews);
    }
    catch (error) {
        console.error('뉴스 번역 API 오류:', error);
        return response_helper_1.ResponseHelper.internalServerError(res, '번역 중 오류가 발생했습니다.');
    }
}));
// =============================================================================
// 사용자 설정 관리
// =============================================================================
/**
 * PUT /api/translation/user/language
 * 사용자 언어 설정 업데이트
 */
router.put('/user/language', auth_middleware_1.authenticateToken, (0, validation_middleware_1.createValidationMiddleware)(validation_middleware_1.UserValidation.updateLanguage()), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const { language } = req.body;
        if (!userId) {
            return response_helper_1.ResponseHelper.unauthorized(res);
        }
        const updatedUser = yield server_1.prisma.user.update({
            where: { id: parseInt(userId) },
            data: { language },
            select: {
                id: true,
                name: true,
                language: true
            }
        });
        return response_helper_1.ResponseHelper.success(res, updatedUser);
    }
    catch (error) {
        console.error('언어 설정 업데이트 오류:', error);
        return response_helper_1.ResponseHelper.internalServerError(res, '언어 설정 업데이트 중 오류가 발생했습니다.');
    }
}));
/**
 * GET /api/translation/user/language
 * 사용자 언어 설정 조회
 */
router.get('/user/language', auth_middleware_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return response_helper_1.ResponseHelper.unauthorized(res);
        }
        const user = yield server_1.prisma.user.findUnique({
            where: { id: parseInt(userId) },
            select: {
                id: true,
                name: true,
                language: true
            }
        });
        if (!user) {
            return response_helper_1.ResponseHelper.notFound(res, '사용자를 찾을 수 없습니다.');
        }
        return response_helper_1.ResponseHelper.success(res, user);
    }
    catch (error) {
        console.error('언어 설정 조회 오류:', error);
        return response_helper_1.ResponseHelper.internalServerError(res, '언어 설정 조회 중 오류가 발생했습니다.');
    }
}));
// =============================================================================
// 번역 캐시 관리 (관리자용)
// =============================================================================
/**
 * GET /api/translation/cache/status
 * 번역 캐시 상태 조회
 */
router.get('/cache/status', auth_middleware_1.authenticateToken, translation_controller_1.getCacheStatus);
/**
 * POST /api/translation/cache/cleanup
 * 번역 캐시 정리
 */
router.post('/cache/cleanup', auth_middleware_1.authenticateToken, translation_controller_1.cleanupCache);
/**
 * DELETE /api/translation/cache/languages/:targetLang
 * 특정 언어의 번역 캐시 삭제
 */
router.delete('/cache/languages/:targetLang', auth_middleware_1.authenticateToken, (0, validation_middleware_1.createValidationMiddleware)([
    validation_middleware_1.ValidationRules.id('targetLang')
]), translation_controller_1.clearLanguageCache);
/**
 * DELETE /api/translation/cache
 * 번역 캐시 전체 삭제
 */
router.delete('/cache', auth_middleware_1.authenticateToken, translation_controller_1.clearAllCache);
// =============================================================================
// 번역 통계 및 관리
// =============================================================================
/**
 * GET /api/translation/stats
 * 번역 통계 조회 (관리자용)
 */
router.get('/stats', auth_middleware_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stats = yield cacheManager.getTranslationStats();
        const cacheStatus = yield cacheManager.getCacheStatus();
        return response_helper_1.ResponseHelper.success(res, Object.assign(Object.assign({}, stats), { cacheStatus }));
    }
    catch (error) {
        console.error('번역 통계 조회 오류:', error);
        return response_helper_1.ResponseHelper.internalServerError(res, '통계 조회 중 오류가 발생했습니다.');
    }
}));
exports.default = router;
