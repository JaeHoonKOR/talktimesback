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
exports.getLanguageStatistics = exports.getTranslationStatistics = exports.clearLanguageTranslationCache = exports.cleanupTranslationCache = exports.getTranslationCacheStatus = exports.updateUserTranslationPreferences = exports.getUserTranslationPreferences = exports.createPublicTranslation = exports.deleteTranslation = exports.getTranslationHistory = exports.getTranslation = exports.createBatchTranslations = exports.createTranslation = exports.clearAllCache = exports.clearLanguageCache = exports.cleanupCache = exports.getCacheStatus = exports.translateBatch = exports.translateText = void 0;
const cache_manager_1 = require("../services/translation/cache-manager");
const translation_service_1 = require("../services/translation/translation-service");
const translationService = new translation_service_1.TranslationService();
const cacheManager = new cache_manager_1.TranslationCacheManager();
const translateText = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { text, targetLang } = req.body;
        if (!text || !targetLang) {
            return res.status(400).json({
                error: '텍스트와 대상 언어가 필요합니다.'
            });
        }
        const translatedText = yield translationService.translateText(text, targetLang);
        res.json({ translatedText });
    }
    catch (error) {
        console.error('번역 요청 처리 중 오류:', error);
        res.status(500).json({
            error: '번역 처리 중 오류가 발생했습니다.'
        });
    }
});
exports.translateText = translateText;
const translateBatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { texts, targetLang } = req.body;
        if (!Array.isArray(texts) || !targetLang) {
            return res.status(400).json({
                error: '텍스트 배열과 대상 언어가 필요합니다.'
            });
        }
        const translatedTexts = yield translationService.translateBatch(texts, targetLang);
        res.json({ translatedTexts });
    }
    catch (error) {
        console.error('배치 번역 요청 처리 중 오류:', error);
        res.status(500).json({
            error: '배치 번역 처리 중 오류가 발생했습니다.'
        });
    }
});
exports.translateBatch = translateBatch;
const getCacheStatus = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const status = yield cacheManager.getCacheStatus();
        res.json(status);
    }
    catch (error) {
        console.error('캐시 상태 조회 중 오류:', error);
        res.status(500).json({
            error: '캐시 상태 조회 중 오류가 발생했습니다.'
        });
    }
});
exports.getCacheStatus = getCacheStatus;
const cleanupCache = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { days = 30 } = req.query;
        const daysNum = Number(days);
        if (isNaN(daysNum) || daysNum < 1) {
            return res.status(400).json({
                error: '유효한 일수를 지정해주세요.'
            });
        }
        const count = yield cacheManager.cleanupOldTranslations(daysNum);
        res.json({
            message: `${count}개의 오래된 번역을 정리했습니다.`
        });
    }
    catch (error) {
        console.error('캐시 정리 중 오류:', error);
        res.status(500).json({
            error: '캐시 정리 중 오류가 발생했습니다.'
        });
    }
});
exports.cleanupCache = cleanupCache;
const clearLanguageCache = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { targetLang } = req.params;
        if (!targetLang) {
            return res.status(400).json({
                error: '대상 언어를 지정해주세요.'
            });
        }
        const count = yield cacheManager.clearTranslationsByLanguage(targetLang);
        res.json({
            message: `${targetLang} 언어의 ${count}개 번역을 삭제했습니다.`
        });
    }
    catch (error) {
        console.error('언어별 캐시 삭제 중 오류:', error);
        res.status(500).json({
            error: '언어별 캐시 삭제 중 오류가 발생했습니다.'
        });
    }
});
exports.clearLanguageCache = clearLanguageCache;
const clearAllCache = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const count = yield cacheManager.clearAllTranslations();
        res.json({
            message: `전체 ${count}개의 번역을 삭제했습니다.`
        });
    }
    catch (error) {
        console.error('전체 캐시 삭제 중 오류:', error);
        res.status(500).json({
            error: '전체 캐시 삭제 중 오류가 발생했습니다.'
        });
    }
});
exports.clearAllCache = clearAllCache;
// 새로운 번역 생성 (인증된 사용자)
const createTranslation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { text, targetLang, sourceLang = 'auto' } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!text || !targetLang) {
            return res.status(400).json({
                error: '텍스트와 대상 언어가 필요합니다.'
            });
        }
        const result = yield translationService.translateText(text, targetLang, sourceLang, userId);
        res.json(result);
    }
    catch (error) {
        console.error('번역 생성 중 오류:', error);
        res.status(500).json({
            error: '번역 생성 중 오류가 발생했습니다.'
        });
    }
});
exports.createTranslation = createTranslation;
// 배치 번역 생성
const createBatchTranslations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { texts, targetLang, sourceLang = 'auto' } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!Array.isArray(texts) || !targetLang) {
            return res.status(400).json({
                error: '텍스트 배열과 대상 언어가 필요합니다.'
            });
        }
        const results = yield translationService.translateBatch(texts, targetLang, sourceLang, userId);
        res.json({ translations: results });
    }
    catch (error) {
        console.error('배치 번역 생성 중 오류:', error);
        res.status(500).json({
            error: '배치 번역 생성 중 오류가 발생했습니다.'
        });
    }
});
exports.createBatchTranslations = createBatchTranslations;
// 특정 번역 조회
const getTranslation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const translation = yield translationService.getTranslationById(id);
        if (!translation) {
            return res.status(404).json({
                error: '번역을 찾을 수 없습니다.'
            });
        }
        res.json(translation);
    }
    catch (error) {
        console.error('번역 조회 중 오류:', error);
        res.status(500).json({
            error: '번역 조회 중 오류가 발생했습니다.'
        });
    }
});
exports.getTranslation = getTranslation;
// 번역 히스토리 조회
const getTranslationHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const { page = 1, limit = 20 } = req.query;
        const history = yield translationService.getUserTranslationHistory(userId, Number(page), Number(limit));
        res.json(history);
    }
    catch (error) {
        console.error('번역 히스토리 조회 중 오류:', error);
        res.status(500).json({
            error: '번역 히스토리 조회 중 오류가 발생했습니다.'
        });
    }
});
exports.getTranslationHistory = getTranslationHistory;
// 번역 삭제
const deleteTranslation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const deleted = yield translationService.deleteTranslation(id, userId);
        if (!deleted) {
            return res.status(404).json({
                error: '번역을 찾을 수 없거나 삭제 권한이 없습니다.'
            });
        }
        res.json({ message: '번역이 삭제되었습니다.' });
    }
    catch (error) {
        console.error('번역 삭제 중 오류:', error);
        res.status(500).json({
            error: '번역 삭제 중 오류가 발생했습니다.'
        });
    }
});
exports.deleteTranslation = deleteTranslation;
// 공개 번역 생성
const createPublicTranslation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { text, targetLang, sourceLang = 'auto' } = req.body;
        if (!text || !targetLang) {
            return res.status(400).json({
                error: '텍스트와 대상 언어가 필요합니다.'
            });
        }
        // 공개 API는 캐시만 사용, DB 저장 안함
        const result = yield translationService.translateText(text, targetLang, sourceLang);
        res.json(result);
    }
    catch (error) {
        console.error('공개 번역 생성 중 오류:', error);
        res.status(500).json({
            error: '공개 번역 생성 중 오류가 발생했습니다.'
        });
    }
});
exports.createPublicTranslation = createPublicTranslation;
// 사용자 번역 설정 조회
const getUserTranslationPreferences = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const preferences = yield translationService.getUserPreferences(userId);
        res.json(preferences);
    }
    catch (error) {
        console.error('사용자 번역 설정 조회 중 오류:', error);
        res.status(500).json({
            error: '사용자 번역 설정 조회 중 오류가 발생했습니다.'
        });
    }
});
exports.getUserTranslationPreferences = getUserTranslationPreferences;
// 사용자 번역 설정 업데이트
const updateUserTranslationPreferences = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const preferences = req.body;
        const updated = yield translationService.updateUserPreferences(userId, preferences);
        res.json(updated);
    }
    catch (error) {
        console.error('사용자 번역 설정 업데이트 중 오류:', error);
        res.status(500).json({
            error: '사용자 번역 설정 업데이트 중 오류가 발생했습니다.'
        });
    }
});
exports.updateUserTranslationPreferences = updateUserTranslationPreferences;
// 번역 캐시 상태 조회
const getTranslationCacheStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const status = yield cacheManager.getCacheStatus();
        res.json(status);
    }
    catch (error) {
        console.error('번역 캐시 상태 조회 중 오류:', error);
        res.status(500).json({
            error: '번역 캐시 상태 조회 중 오류가 발생했습니다.'
        });
    }
});
exports.getTranslationCacheStatus = getTranslationCacheStatus;
// 번역 캐시 정리
const cleanupTranslationCache = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { days = 30 } = req.query;
        const daysNum = Number(days);
        if (isNaN(daysNum) || daysNum < 1) {
            return res.status(400).json({
                error: '유효한 일수를 지정해주세요.'
            });
        }
        const count = yield cacheManager.cleanupOldTranslations(daysNum);
        res.json({
            message: `${count}개의 오래된 번역을 정리했습니다.`
        });
    }
    catch (error) {
        console.error('번역 캐시 정리 중 오류:', error);
        res.status(500).json({
            error: '번역 캐시 정리 중 오류가 발생했습니다.'
        });
    }
});
exports.cleanupTranslationCache = cleanupTranslationCache;
// 특정 언어 번역 캐시 삭제
const clearLanguageTranslationCache = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { lang } = req.params;
        if (!lang) {
            return res.status(400).json({
                error: '대상 언어를 지정해주세요.'
            });
        }
        const count = yield cacheManager.clearTranslationsByLanguage(lang);
        res.json({
            message: `${lang} 언어의 ${count}개 번역을 삭제했습니다.`
        });
    }
    catch (error) {
        console.error('언어별 번역 캐시 삭제 중 오류:', error);
        res.status(500).json({
            error: '언어별 번역 캐시 삭제 중 오류가 발생했습니다.'
        });
    }
});
exports.clearLanguageTranslationCache = clearLanguageTranslationCache;
// 번역 통계 조회
const getTranslationStatistics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.query;
        const stats = yield translationService.getTranslationStatistics(startDate, endDate);
        res.json(stats);
    }
    catch (error) {
        console.error('번역 통계 조회 중 오류:', error);
        res.status(500).json({
            error: '번역 통계 조회 중 오류가 발생했습니다.'
        });
    }
});
exports.getTranslationStatistics = getTranslationStatistics;
// 언어별 번역 통계 조회
const getLanguageStatistics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.query;
        const stats = yield translationService.getLanguageStatistics(startDate, endDate);
        res.json(stats);
    }
    catch (error) {
        console.error('언어별 번역 통계 조회 중 오류:', error);
        res.status(500).json({
            error: '언어별 번역 통계 조회 중 오류가 발생했습니다.'
        });
    }
});
exports.getLanguageStatistics = getLanguageStatistics;
