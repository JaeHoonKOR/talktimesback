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
exports.getLatestNewsByCategory = void 0;
exports.fetchAndSaveNews = fetchAndSaveNews;
exports.fetchAndSaveNewsByCategory = fetchAndSaveNewsByCategory;
exports.getNews = getNews;
exports.searchNewsByKeywords = searchNewsByKeywords;
exports.getLatestNews = getLatestNews;
exports.getNewsByCategory = getNewsByCategory;
exports.getPersonalizedNews = getPersonalizedNews;
exports.getNewsById = getNewsById;
exports.summarizeNews = summarizeNews;
exports.batchProcessNews = batchProcessNews;
exports.getNewsStats = getNewsStats;
exports.getRssSources = getRssSources;
exports.updateNews = updateNews;
exports.deleteNews = deleteNews;
exports.createNewsSummary = createNewsSummary;
exports.createNewsCollection = createNewsCollection;
exports.getNewsCollections = getNewsCollections;
exports.updateNewsCollection = updateNewsCollection;
const server_1 = require("../server");
const aiSummaryService = __importStar(require("../services/news/ai-summary-service"));
const newsRepository = __importStar(require("../services/news/news-repository"));
const rssService = __importStar(require("../services/news/rss-service"));
const rss_sources_1 = require("../services/news/rss-sources");
const response_helper_1 = require("../utils/response.helper");
/**
 * 최신 뉴스 수집 및 DB 저장
 */
function fetchAndSaveNews(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 1. 모든 RSS 피드에서 뉴스 가져오기
            const allNews = yield rssService.fetchAllNews();
            // 2. 중복 제거
            const uniqueNews = rssService.deduplicateNews(allNews);
            // 3. DB에 저장
            const savedCount = yield newsRepository.saveNewsItems(uniqueNews);
            const result = {
                message: `${savedCount}개의 새로운 뉴스 항목이 저장되었습니다.`,
                total: uniqueNews.length,
                saved: savedCount,
            };
            return response_helper_1.ResponseHelper.success(res, result);
        }
        catch (error) {
            console.error('뉴스 수집 및 저장 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 수집 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 특정 카테고리의 뉴스 수집 및 DB 저장
 */
function fetchAndSaveNewsByCategory(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { category } = req.params;
        try {
            // 카테고리별 RSS 소스 확인
            const sources = (0, rss_sources_1.getRssSourcesByCategory)(category);
            if (sources.length === 0) {
                return response_helper_1.ResponseHelper.notFound(res, `'${category}' 카테고리에 대한 RSS 소스가 없습니다.`);
            }
            // 뉴스 가져오기
            const categoryNews = yield rssService.fetchNewsByCategory(category);
            // 중복 제거
            const uniqueNews = rssService.deduplicateNews(categoryNews);
            // DB에 저장
            const savedCount = yield newsRepository.saveNewsItems(uniqueNews);
            const result = {
                message: `${category} 카테고리에서 ${savedCount}개의 새로운 뉴스 항목이 저장되었습니다.`,
                category,
                total: uniqueNews.length,
                saved: savedCount,
            };
            return response_helper_1.ResponseHelper.success(res, result);
        }
        catch (error) {
            console.error(`${category} 카테고리 뉴스 수집 및 저장 중 오류 발생:`, error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 수집 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 뉴스 목록 가져오기 (필터링 옵션 적용)
 */
function getNews(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 쿼리 파라미터에서 필터링 옵션 추출
            const { categories, sources, keywords, startDate, endDate, page = '1', limit = '50', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const offset = (pageNum - 1) * limitNum;
            // 필터링 옵션 구성
            const options = {
                categories: Array.isArray(categories)
                    ? categories
                    : categories
                        ? [categories]
                        : undefined,
                sources: Array.isArray(sources)
                    ? sources
                    : sources
                        ? [sources]
                        : undefined,
                keywords: Array.isArray(keywords)
                    ? keywords
                    : keywords
                        ? [keywords]
                        : undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                limit: limitNum,
                offset: offset,
            };
            // 뉴스 조회
            const newsItems = yield newsRepository.getNewsItems(options);
            // content null을 undefined로 변환
            const formattedNews = newsItems.map(item => {
                var _a, _b;
                return (Object.assign(Object.assign({}, item), { content: item.content || undefined, imageUrl: item.imageUrl || undefined, publishedAt: item.publishedAt.toISOString(), createdAt: ((_a = item.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || new Date().toISOString(), updatedAt: ((_b = item.updatedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || new Date().toISOString() }));
            });
            // 총 개수 조회 (페이지네이션용)
            const totalCount = newsItems.length;
            return response_helper_1.ResponseHelper.paginatedSuccess(res, formattedNews, pageNum, limitNum, totalCount);
        }
        catch (error) {
            console.error('뉴스 목록 조회 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 목록을 가져오는 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 뉴스 검색 (키워드 기반)
 */
function searchNewsByKeywords(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { keywords, category, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const offset = (pageNum - 1) * limitNum;
            // 키워드 파싱
            let keywordArray = [];
            if (typeof keywords === 'string') {
                keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
            }
            else if (Array.isArray(keywords)) {
                keywordArray = keywords;
            }
            const options = {
                keywords: keywordArray,
                categories: category ? [category] : undefined,
                limit: limitNum,
                offset: offset,
            };
            const newsItems = yield newsRepository.getNewsItems(options);
            const totalCount = newsItems.length;
            const formattedNews = newsItems.map(item => {
                var _a, _b;
                return (Object.assign(Object.assign({}, item), { content: item.content || undefined, imageUrl: item.imageUrl || undefined, publishedAt: item.publishedAt.toISOString(), createdAt: ((_a = item.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || new Date().toISOString(), updatedAt: ((_b = item.updatedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || new Date().toISOString() }));
            });
            return response_helper_1.ResponseHelper.paginatedSuccess(res, formattedNews, pageNum, limitNum, totalCount);
        }
        catch (error) {
            console.error('뉴스 검색 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 검색 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 최신 뉴스 목록 조회
 */
function getLatestNews(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { page = '1', limit = '20' } = req.query;
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const offset = (pageNum - 1) * limitNum;
            const options = {
                limit: limitNum,
                offset: offset,
            };
            const newsItems = yield newsRepository.getNewsItems(options);
            const totalCount = newsItems.length;
            const formattedNews = newsItems.map(item => {
                var _a, _b;
                return (Object.assign(Object.assign({}, item), { content: item.content || undefined, imageUrl: item.imageUrl || undefined, publishedAt: item.publishedAt.toISOString(), createdAt: ((_a = item.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || new Date().toISOString(), updatedAt: ((_b = item.updatedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || new Date().toISOString() }));
            });
            return response_helper_1.ResponseHelper.paginatedSuccess(res, formattedNews, pageNum, limitNum, totalCount);
        }
        catch (error) {
            console.error('최신 뉴스 조회 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '최신 뉴스를 가져오는 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 카테고리별 뉴스 목록 조회
 */
function getNewsByCategory(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { category } = req.params;
        const { page = '1', limit = '20' } = req.query;
        try {
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const offset = (pageNum - 1) * limitNum;
            const options = {
                categories: [category],
                limit: limitNum,
                offset: offset,
            };
            const newsItems = yield newsRepository.getLatestNewsByCategory(category, limitNum);
            const totalCount = newsItems.length;
            const formattedNews = newsItems.map(item => {
                var _a, _b;
                return (Object.assign(Object.assign({}, item), { content: item.content || undefined, imageUrl: item.imageUrl || undefined, publishedAt: item.publishedAt.toISOString(), createdAt: ((_a = item.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || new Date().toISOString(), updatedAt: ((_b = item.updatedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || new Date().toISOString() }));
            });
            return response_helper_1.ResponseHelper.paginatedSuccess(res, formattedNews, pageNum, limitNum, totalCount);
        }
        catch (error) {
            console.error(`${category} 카테고리 뉴스 조회 중 오류 발생:`, error);
            return response_helper_1.ResponseHelper.internalServerError(res, '카테고리별 뉴스를 가져오는 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 개인화된 뉴스 목록 조회
 */
function getPersonalizedNews(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const { categories, keywords, limit = 20 } = req.query;
            // 사용자 키워드 조회 (userId를 Int로 변환)
            const userKeywords = yield server_1.prisma.keyword.findMany({
                where: { userId: parseInt(String(userId), 10) }, // userId를 Int로 변환
                select: { keyword: true }
            });
            // 뉴스 조회 옵션 구성
            const options = {
                categories: Array.isArray(categories)
                    ? categories
                    : categories
                        ? [categories]
                        : undefined,
                keywords: Array.isArray(keywords)
                    ? keywords
                    : keywords
                        ? [keywords]
                        : userKeywords.map(k => k.keyword),
                limit: parseInt(limit, 10),
                offset: 0,
            };
            const newsItems = yield newsRepository.getNewsItems(options);
            // null을 undefined로 변환
            const formattedNews = newsItems.map(item => {
                var _a, _b;
                return (Object.assign(Object.assign({}, item), { content: item.content || undefined, imageUrl: item.imageUrl || undefined, publishedAt: item.publishedAt.toISOString(), createdAt: ((_a = item.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || new Date().toISOString(), updatedAt: ((_b = item.updatedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || new Date().toISOString() }));
            });
            return response_helper_1.ResponseHelper.success(res, formattedNews);
        }
        catch (error) {
            console.error('개인화 뉴스 조회 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '개인화 뉴스 조회 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 단일 뉴스 상세 정보 조회
 */
function getNewsById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { id } = req.params;
        try {
            const newsItem = yield newsRepository.getNewsById(id);
            if (!newsItem) {
                return response_helper_1.ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
            }
            const formattedNews = Object.assign(Object.assign({}, newsItem), { content: newsItem.content || undefined, imageUrl: newsItem.imageUrl || undefined, publishedAt: newsItem.publishedAt.toISOString(), createdAt: ((_a = newsItem.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || new Date().toISOString(), updatedAt: ((_b = newsItem.updatedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || new Date().toISOString() });
            return response_helper_1.ResponseHelper.success(res, formattedNews);
        }
        catch (error) {
            console.error('뉴스 상세 조회 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 상세 정보를 가져오는 중 오류가 발생했습니다.');
        }
    });
}
/**
 * AI를 이용한 뉴스 요약
 */
function summarizeNews(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const newsItem = yield newsRepository.getNewsById(id);
            if (!newsItem) {
                return response_helper_1.ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
            }
            // AI 요약 생성
            const summary = yield aiSummaryService.generateSummary(newsItem);
            if (!summary) {
                return response_helper_1.ResponseHelper.externalServiceError(res, 'AI 요약 생성에 실패했습니다.');
            }
            const result = {
                newsId: id,
                title: newsItem.title,
                summary,
                generatedAt: new Date().toISOString()
            };
            return response_helper_1.ResponseHelper.success(res, result);
        }
        catch (error) {
            console.error('뉴스 요약 생성 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 요약 생성 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 처리되지 않은 뉴스 일괄 요약 처리
 */
function batchProcessNews(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { action, newsIds } = req.body;
            if (!Array.isArray(newsIds) || newsIds.length === 0) {
                return response_helper_1.ResponseHelper.badRequest(res, '뉴스 ID 배열이 필요합니다.');
            }
            let processedCount = 0;
            let failedCount = 0;
            for (const newsId of newsIds) {
                try {
                    switch (action) {
                        case 'delete':
                            yield server_1.prisma.news.delete({ where: { id: newsId } });
                            break;
                        case 'archive':
                            yield server_1.prisma.news.update({
                                where: { id: newsId },
                                data: { isProcessed: true }
                            });
                            break;
                        default:
                            throw new Error(`지원하지 않는 액션: ${action}`);
                    }
                    processedCount++;
                }
                catch (error) {
                    console.error(`뉴스 ${newsId} 처리 중 오류:`, error);
                    failedCount++;
                }
            }
            const result = {
                processedCount,
                failedCount,
                totalCount: newsIds.length
            };
            return response_helper_1.ResponseHelper.success(res, result);
        }
        catch (error) {
            console.error('뉴스 배치 처리 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 배치 처리 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 뉴스 통계 정보 조회
 */
function getNewsStats(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const stats = yield newsRepository.getNewsStats(); // 올바른 메서드명 사용
            return response_helper_1.ResponseHelper.success(res, stats);
        }
        catch (error) {
            console.error('뉴스 통계 조회 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 통계 조회 중 오류가 발생했습니다.');
        }
    });
}
/**
 * RSS 피드 소스 목록 조회
 */
function getRssSources(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const sources = (0, rss_sources_1.getActiveRssSources)();
            const result = {
                sources,
                totalCount: sources.length,
                categories: [...new Set(sources.map(s => s.category))]
            };
            return response_helper_1.ResponseHelper.success(res, result);
        }
        catch (error) {
            console.error('RSS 소스 조회 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, 'RSS 소스 목록을 가져오는 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 뉴스 업데이트
 */
function updateNews(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedNews = yield server_1.prisma.news.update({
                where: { id },
                data: updateData
            });
            return response_helper_1.ResponseHelper.success(res, updatedNews, '뉴스가 성공적으로 업데이트되었습니다.');
        }
        catch (error) {
            console.error('뉴스 업데이트 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 업데이트 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 뉴스 삭제
 */
function deleteNews(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            yield server_1.prisma.news.delete({
                where: { id }
            });
            return response_helper_1.ResponseHelper.success(res, null, '뉴스가 성공적으로 삭제되었습니다.');
        }
        catch (error) {
            console.error('뉴스 삭제 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 삭제 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 뉴스 요약 생성
 */
function createNewsSummary(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const newsItem = yield server_1.prisma.news.findUnique({
                where: { id }
            });
            if (!newsItem) {
                return response_helper_1.ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
            }
            // AI 요약 생성 (임시 구현)
            const summary = `${newsItem.title}에 대한 요약입니다.`;
            const updatedNews = yield server_1.prisma.news.update({
                where: { id },
                data: { aiSummary: summary }
            });
            return response_helper_1.ResponseHelper.success(res, updatedNews, '뉴스 요약이 생성되었습니다.');
        }
        catch (error) {
            console.error('뉴스 요약 생성 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 요약 생성 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 뉴스 컬렉션 생성
 */
function createNewsCollection(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { name, description, newsIds } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            // 임시 구현 - 실제로는 NewsCollection 모델이 필요
            const collection = {
                id: `collection_${Date.now()}`,
                name,
                description,
                newsIds: newsIds || [],
                userId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            return response_helper_1.ResponseHelper.success(res, collection, '뉴스 컬렉션이 생성되었습니다.');
        }
        catch (error) {
            console.error('뉴스 컬렉션 생성 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 컬렉션 생성 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 뉴스 컬렉션 목록 조회
 */
function getNewsCollections(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            // 임시 구현 - 실제로는 NewsCollection 모델에서 조회
            const collections = [
                {
                    id: 'collection_1',
                    name: '오늘의 뉴스',
                    description: '오늘의 주요 뉴스 모음',
                    newsCount: 5,
                    userId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            return response_helper_1.ResponseHelper.success(res, collections);
        }
        catch (error) {
            console.error('뉴스 컬렉션 조회 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 컬렉션 조회 중 오류가 발생했습니다.');
        }
    });
}
/**
 * 뉴스 컬렉션 업데이트
 */
function updateNewsCollection(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const updateData = req.body;
            // 임시 구현
            const updatedCollection = Object.assign(Object.assign({ id }, updateData), { updatedAt: new Date() });
            return response_helper_1.ResponseHelper.success(res, updatedCollection, '뉴스 컬렉션이 업데이트되었습니다.');
        }
        catch (error) {
            console.error('뉴스 컬렉션 업데이트 중 오류 발생:', error);
            return response_helper_1.ResponseHelper.internalServerError(res, '뉴스 컬렉션 업데이트 중 오류가 발생했습니다.');
        }
    });
}
// 기존 함수들과의 호환성을 위한 별칭
exports.getLatestNewsByCategory = getNewsByCategory;
