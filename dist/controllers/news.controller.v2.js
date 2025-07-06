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
exports.getNewsStatistics = exports.getNewsCategories = exports.getNewsSources = exports.getNewsTranslation = exports.getNewsSummary = exports.getNewsUnified = void 0;
const server_1 = require("../server");
const logger_1 = require("../utils/logger");
const response_helper_1 = require("../utils/response.helper");
/**
 * 통합 뉴스 목록 조회 (검색, 필터링, 개인화 지원)
 */
const getNewsUnified = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { search, category, sort = 'latest', personalized = 'false', page = 1, limit = 20 } = req.query;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let whereClause = {};
        let orderBy = {};
        // 검색 조건 추가
        if (search) {
            whereClause = {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { excerpt: { contains: search, mode: 'insensitive' } }
                ]
            };
        }
        // 카테고리 필터링
        if (category) {
            whereClause.category = category;
        }
        // 정렬 조건
        switch (sort) {
            case 'latest':
                orderBy = { publishedAt: 'desc' };
                break;
            case 'popular':
                orderBy = { viewCount: 'desc' };
                break;
            case 'relevance':
                orderBy = { publishedAt: 'desc' };
                break;
            default:
                orderBy = { publishedAt: 'desc' };
        }
        // 개인화 뉴스 처리 (추후 구현)
        if (personalized === 'true' && userId) {
            // 사용자 관심사 기반 뉴스 필터링 로직
            const userKeywords = yield server_1.prisma.keyword.findMany({
                where: { userId: parseInt(userId) },
                select: { keyword: true }
            });
            if (userKeywords.length > 0) {
                const keywords = userKeywords.map(k => k.keyword);
                whereClause.OR = [
                    ...(whereClause.OR || []),
                    ...keywords.map(keyword => ({
                        title: { contains: keyword, mode: 'insensitive' }
                    }))
                ];
            }
        }
        const [newsList, totalCount] = yield Promise.all([
            server_1.prisma.news.findMany({
                where: whereClause,
                orderBy,
                skip: offset,
                take: parseInt(limit),
                select: {
                    id: true,
                    title: true,
                    url: true,
                    source: true,
                    category: true,
                    publishedAt: true,
                    excerpt: true,
                    content: true,
                    imageUrl: true,
                    createdAt: true,
                    updatedAt: true
                }
            }),
            server_1.prisma.news.count({ where: whereClause })
        ]);
        const hasMore = offset + newsList.length < totalCount;
        return response_helper_1.ResponseHelper.success(res, {
            news: newsList,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalCount,
                hasMore
            },
            filters: {
                search,
                category,
                sort,
                personalized: personalized === 'true' && !!userId
            }
        });
    }
    catch (error) {
        logger_1.serverLogger.error('뉴스 목록 조회 중 오류 발생', error);
        return response_helper_1.ResponseHelper.internalServerError(res);
    }
});
exports.getNewsUnified = getNewsUnified;
/**
 * 뉴스 요약 조회
 */
const getNewsSummary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const news = yield server_1.prisma.news.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                url: true,
                source: true,
                category: true,
                publishedAt: true,
                excerpt: true,
                content: true,
                imageUrl: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!news) {
            return response_helper_1.ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
        }
        // AI 요약이 없는 경우 기본 설명 반환
        const summary = news.excerpt || ((_a = news.content) === null || _a === void 0 ? void 0 : _a.substring(0, 200)) + '...';
        return response_helper_1.ResponseHelper.success(res, {
            id: news.id,
            title: news.title,
            summary,
            publishedAt: news.publishedAt,
            createdAt: news.createdAt
        });
    }
    catch (error) {
        logger_1.serverLogger.error('뉴스 요약 조회 중 오류 발생', error);
        return response_helper_1.ResponseHelper.internalServerError(res);
    }
});
exports.getNewsSummary = getNewsSummary;
/**
 * 뉴스 번역 조회
 */
const getNewsTranslation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, lang } = req.params;
        const news = yield server_1.prisma.news.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                url: true,
                source: true,
                category: true,
                publishedAt: true,
                excerpt: true,
                content: true,
                imageUrl: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!news) {
            return response_helper_1.ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
        }
        // 번역 캐시 확인 (추후 구현)
        // const translationCache = await getTranslationCache(news.id, lang);
        // 임시로 원본 데이터 반환
        return response_helper_1.ResponseHelper.success(res, {
            id: news.id,
            title: news.title,
            url: news.url,
            source: news.source,
            category: news.category,
            publishedAt: news.publishedAt,
            excerpt: news.excerpt,
            content: news.content,
            imageUrl: news.imageUrl,
            language: lang,
            translated: false // 실제 번역 구현 시 true로 변경
        });
    }
    catch (error) {
        logger_1.serverLogger.error('뉴스 번역 조회 중 오류 발생', error);
        return response_helper_1.ResponseHelper.internalServerError(res);
    }
});
exports.getNewsTranslation = getNewsTranslation;
/**
 * 뉴스 소스 목록 조회
 */
const getNewsSources = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sources = yield server_1.prisma.news.groupBy({
            by: ['source'],
            _count: {
                id: true
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            }
        });
        return response_helper_1.ResponseHelper.success(res, {
            sources: sources.map(source => ({
                name: source.source,
                count: source._count.id
            }))
        });
    }
    catch (error) {
        logger_1.serverLogger.error('뉴스 소스 조회 중 오류 발생', error);
        return response_helper_1.ResponseHelper.internalServerError(res);
    }
});
exports.getNewsSources = getNewsSources;
/**
 * 뉴스 카테고리 목록 조회
 */
const getNewsCategories = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const categories = yield server_1.prisma.news.groupBy({
            by: ['category'],
            _count: {
                id: true
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            }
        });
        return response_helper_1.ResponseHelper.success(res, {
            categories: categories.map(category => ({
                name: category.category,
                count: category._count.id
            }))
        });
    }
    catch (error) {
        logger_1.serverLogger.error('뉴스 카테고리 조회 중 오류 발생', error);
        return response_helper_1.ResponseHelper.internalServerError(res);
    }
});
exports.getNewsCategories = getNewsCategories;
/**
 * 뉴스 통계 조회
 */
const getNewsStatistics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [totalNews, todayNews, categoryStat, sourceStat] = yield Promise.all([
            server_1.prisma.news.count(),
            server_1.prisma.news.count({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            }),
            server_1.prisma.news.groupBy({
                by: ['category'],
                _count: { id: true }
            }),
            server_1.prisma.news.groupBy({
                by: ['source'],
                _count: { id: true }
            })
        ]);
        return response_helper_1.ResponseHelper.success(res, {
            totalNews,
            todayNews,
            categories: categoryStat.map(c => ({
                name: c.category,
                count: c._count.id
            })),
            sources: sourceStat.map(s => ({
                name: s.source,
                count: s._count.id
            }))
        });
    }
    catch (error) {
        logger_1.serverLogger.error('뉴스 통계 조회 중 오류 발생', error);
        return response_helper_1.ResponseHelper.internalServerError(res);
    }
});
exports.getNewsStatistics = getNewsStatistics;
