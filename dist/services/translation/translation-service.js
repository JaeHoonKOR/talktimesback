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
exports.TranslationService = void 0;
const server_1 = require("../../server");
/**
 * 번역 서비스 클래스
 * Google Cloud Translate API를 사용하여 텍스트를 번역하고 PostgreSQL에 캐싱합니다.
 */
class TranslationService {
    constructor() {
        this.apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || '';
        this.apiUrl = 'https://translation.googleapis.com/language/translate/v2';
        if (!this.apiKey) {
            console.warn('⚠️ Google Translate API 키가 설정되지 않았습니다. 번역 기능이 제한됩니다.');
        }
    }
    /**
     * 캐시된 번역 조회
     */
    getCachedTranslation(sourceText, targetLang) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cached = yield server_1.prisma.translation.findUnique({
                    where: {
                        sourceText_targetLang: {
                            sourceText,
                            targetLang
                        }
                    }
                });
                if (cached) {
                    // 사용 통계 업데이트
                    try {
                        yield server_1.prisma.translation.update({
                            where: { id: cached.id },
                            data: {
                                usageCount: { increment: 1 },
                                lastUsedAt: new Date()
                            }
                        });
                    }
                    catch (updateError) {
                        // 통계 업데이트 실패는 무시하고 캐시된 번역 반환
                        console.warn('캐시 사용 통계 업데이트 실패:', updateError);
                    }
                }
                return cached;
            }
            catch (error) {
                console.error('캐시 조회 중 오류:', error);
                return null; // 오류 발생 시 캐시 없음으로 처리
            }
        });
    }
    /**
     * Google Translate API를 사용하여 텍스트 번역
     */
    translateWithAPI(text, targetLang) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.apiKey) {
                // API 키가 없는 경우 모의 번역 반환
                return `[${targetLang.toUpperCase()}] ${text}`;
            }
            try {
                const response = yield fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        q: text,
                        target: targetLang,
                        source: 'ko'
                    })
                });
                if (!response.ok) {
                    throw new Error(`Google Translate API 오류: ${response.status}`);
                }
                const data = yield response.json();
                return data.data.translations[0].translatedText;
            }
            catch (error) {
                console.error('Google Translate API 호출 실패:', error);
                // 실패 시 모의 번역 반환
                return `[${targetLang.toUpperCase()}] ${text}`;
            }
        });
    }
    /**
     * 번역 결과를 캐시에 저장
     */
    saveTranslationToCache(sourceText, targetLang, translatedText, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield server_1.prisma.translation.create({
                    data: {
                        sourceText,
                        targetLang,
                        translatedText,
                        userId
                    }
                });
            }
            catch (error) {
                // 캐시 저장 실패는 로깅만 하고 무시 (번역 기능 자체는 계속 동작)
                console.warn('번역 캐시 저장 중 오류 (무시됨):', error);
            }
        });
    }
    /**
     * 텍스트 번역 (캐시 우선)
     */
    translateText(text, targetLang, sourceLang, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!text || text.trim() === '') {
                return text;
            }
            // 같은 언어인 경우 원본 반환
            if (targetLang === 'ko') {
                return text;
            }
            try {
                let translatedText;
                try {
                    // 1. 캐시 확인 시도
                    const cached = yield this.getCachedTranslation(text, targetLang);
                    if (cached) {
                        console.log(`캐시에서 번역 조회: ${text.substring(0, 50)}...`);
                        return cached.translatedText;
                    }
                }
                catch (cacheError) {
                    // 캐시 조회 실패는 무시하고 API 번역 진행
                    console.warn('캐시 조회 실패, API 번역으로 진행:', cacheError);
                }
                // 2. 새로운 번역 수행
                console.log(`새로운 번역 수행: ${text.substring(0, 50)}...`);
                translatedText = yield this.translateWithAPI(text, targetLang);
                // 3. 캐시에 저장 시도 (userId 포함)
                try {
                    yield this.saveTranslationToCache(text, targetLang, translatedText, userId);
                }
                catch (saveError) {
                    // 캐시 저장 실패는 무시
                    console.warn('캐시 저장 실패 (무시됨):', saveError);
                }
                return translatedText;
            }
            catch (error) {
                console.error('번역 중 오류 발생:', error);
                return text; // 실패 시 원본 텍스트 반환
            }
        });
    }
    /**
     * 뉴스 항목 번역
     */
    translateNews(newsId, targetLang) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const news = yield server_1.prisma.news.findUnique({
                    where: { id: newsId }
                });
                if (!news) {
                    throw new Error('뉴스를 찾을 수 없습니다.');
                }
                // 같은 언어인 경우 원본 반환
                if (targetLang === 'ko') {
                    return news;
                }
                // 제목과 요약 번역
                const [translatedTitle, translatedExcerpt] = yield Promise.all([
                    this.translateText(news.title, targetLang),
                    this.translateText(news.excerpt, targetLang)
                ]);
                // 본문이 있는 경우 번역
                let translatedContent;
                if (news.content) {
                    translatedContent = yield this.translateText(news.content, targetLang);
                }
                return Object.assign(Object.assign({ title: translatedTitle, excerpt: translatedExcerpt, content: translatedContent, originalTitle: news.title, originalExcerpt: news.excerpt, originalContent: news.content, translatedLang: targetLang }, news), { imageUrl: news.imageUrl || undefined });
            }
            catch (error) {
                console.error('뉴스 번역 중 오류:', error);
                return null;
            }
        });
    }
    /**
     * 배치 번역
     */
    translateBatch(texts, targetLang, sourceLang, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(texts) || texts.length === 0) {
                return [];
            }
            try {
                const translations = yield Promise.all(texts.map(text => this.translateText(text, targetLang, sourceLang, userId)));
                return translations;
            }
            catch (error) {
                console.error('배치 번역 중 오류 발생:', error);
                return texts; // 실패 시 원본 텍스트 배열 반환
            }
        });
    }
    /**
     * 사용자 언어 설정에 따른 뉴스 목록 번역
     */
    translateNewsList(newsList, targetLang) {
        return __awaiter(this, void 0, void 0, function* () {
            if (targetLang === 'ko') {
                return newsList;
            }
            try {
                const translatedNews = yield Promise.all(newsList.map((news) => __awaiter(this, void 0, void 0, function* () {
                    const [translatedTitle, translatedExcerpt] = yield Promise.all([
                        this.translateText(news.title, targetLang),
                        this.translateText(news.excerpt, targetLang)
                    ]);
                    return Object.assign(Object.assign({}, news), { title: translatedTitle, excerpt: translatedExcerpt, originalTitle: news.title, originalExcerpt: news.excerpt, translatedLang: targetLang });
                })));
                return translatedNews;
            }
            catch (error) {
                console.error('뉴스 목록 번역 중 오류:', error);
                return newsList;
            }
        });
    }
    /**
     * 번역 ID로 번역 조회
     */
    getTranslationById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield server_1.prisma.translation.findUnique({
                    where: { id }
                });
            }
            catch (error) {
                console.error('번역 조회 중 오류:', error);
                return null;
            }
        });
    }
    /**
     * 사용자 번역 히스토리 조회
     */
    getUserTranslationHistory(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20) {
            try {
                const offset = (page - 1) * limit;
                const [translations, total] = yield Promise.all([
                    server_1.prisma.translation.findMany({
                        where: { userId },
                        orderBy: { createdAt: 'desc' },
                        skip: offset,
                        take: limit
                    }),
                    server_1.prisma.translation.count({
                        where: { userId }
                    })
                ]);
                return {
                    translations,
                    total,
                    page,
                    limit
                };
            }
            catch (error) {
                console.error('사용자 번역 히스토리 조회 중 오류:', error);
                return {
                    translations: [],
                    total: 0,
                    page,
                    limit
                };
            }
        });
    }
    /**
     * 번역 삭제
     */
    deleteTranslation(id, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const translation = yield server_1.prisma.translation.findUnique({
                    where: { id }
                });
                if (!translation) {
                    return false;
                }
                // 사용자 권한 확인 (본인 또는 관리자만)
                if (translation.userId !== userId) {
                    return false;
                }
                yield server_1.prisma.translation.delete({
                    where: { id }
                });
                return true;
            }
            catch (error) {
                console.error('번역 삭제 중 오류:', error);
                return false;
            }
        });
    }
    /**
     * 사용자 번역 설정 조회
     */
    getUserPreferences(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 임시 구현 - 실제로는 UserPreferences 모델이 필요
                return {
                    userId,
                    defaultTargetLang: 'en',
                    defaultSourceLang: 'ko',
                    autoDetectSource: true,
                    preferredTranslationEngine: 'google',
                    saveTranslationHistory: true
                };
            }
            catch (error) {
                console.error('사용자 번역 설정 조회 중 오류:', error);
                return null;
            }
        });
    }
    /**
     * 사용자 번역 설정 업데이트
     */
    updateUserPreferences(userId, preferences) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 임시 구현 - 실제로는 UserPreferences 모델이 필요
                return Object.assign(Object.assign({ userId }, preferences), { updatedAt: new Date() });
            }
            catch (error) {
                console.error('사용자 번역 설정 업데이트 중 오류:', error);
                return null;
            }
        });
    }
    /**
     * 번역 통계 조회
     */
    getTranslationStatistics(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const whereClause = {};
                if (startDate || endDate) {
                    whereClause.createdAt = {};
                    if (startDate)
                        whereClause.createdAt.gte = new Date(startDate);
                    if (endDate)
                        whereClause.createdAt.lte = new Date(endDate);
                }
                const [totalTranslations, uniqueUsers, languageStats] = yield Promise.all([
                    server_1.prisma.translation.count({ where: whereClause }),
                    server_1.prisma.translation.findMany({
                        where: whereClause,
                        select: { userId: true },
                        distinct: ['userId']
                    }),
                    server_1.prisma.translation.groupBy({
                        by: ['targetLang'],
                        _count: { id: true },
                        where: whereClause,
                        orderBy: { _count: { id: 'desc' } }
                    })
                ]);
                return {
                    totalTranslations,
                    uniqueUsers: uniqueUsers.length,
                    languageStats: languageStats.map(stat => ({
                        language: stat.targetLang,
                        count: stat._count.id
                    })),
                    period: {
                        startDate: startDate || null,
                        endDate: endDate || null
                    }
                };
            }
            catch (error) {
                console.error('번역 통계 조회 중 오류:', error);
                return {
                    totalTranslations: 0,
                    uniqueUsers: 0,
                    languageStats: [],
                    period: { startDate: null, endDate: null }
                };
            }
        });
    }
    /**
     * 언어별 번역 통계 조회
     */
    getLanguageStatistics(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const whereClause = {};
                if (startDate || endDate) {
                    whereClause.createdAt = {};
                    if (startDate)
                        whereClause.createdAt.gte = new Date(startDate);
                    if (endDate)
                        whereClause.createdAt.lte = new Date(endDate);
                }
                const languageStats = yield server_1.prisma.translation.groupBy({
                    by: ['targetLang'],
                    _count: { id: true },
                    _sum: { usageCount: true },
                    where: whereClause,
                    orderBy: { _count: { id: 'desc' } }
                });
                return {
                    languages: languageStats.map(stat => ({
                        language: stat.targetLang,
                        translationCount: stat._count.id,
                        totalUsage: stat._sum.usageCount || 0
                    })),
                    period: {
                        startDate: startDate || null,
                        endDate: endDate || null
                    }
                };
            }
            catch (error) {
                console.error('언어별 번역 통계 조회 중 오류:', error);
                return {
                    languages: [],
                    period: { startDate: null, endDate: null }
                };
            }
        });
    }
}
exports.TranslationService = TranslationService;
