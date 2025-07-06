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
exports.saveNewsItem = saveNewsItem;
exports.saveNewsItems = saveNewsItems;
exports.getNewsById = getNewsById;
exports.getNewsItems = getNewsItems;
exports.getLatestNewsByCategory = getLatestNewsByCategory;
exports.updateNewsProcessingStatus = updateNewsProcessingStatus;
exports.getUnprocessedNewsItems = getUnprocessedNewsItems;
exports.getNewsStats = getNewsStats;
exports.createNewsItem = createNewsItem;
exports.getNewsByCategory = getNewsByCategory;
exports.getLatestNews = getLatestNews;
const server_1 = require("../../server");
/**
 * 단일 뉴스 항목 저장
 */
function saveNewsItem(newsItem) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield server_1.prisma.news.create({
            data: {
                id: newsItem.id,
                title: newsItem.title,
                url: newsItem.url,
                source: newsItem.source,
                sourceId: newsItem.sourceId,
                category: newsItem.category,
                publishedAt: newsItem.publishedAt,
                excerpt: newsItem.excerpt,
                content: newsItem.content || '',
                imageUrl: newsItem.imageUrl || null,
                isProcessed: newsItem.isProcessed,
            },
        });
        return {
            id: result.id,
            title: result.title,
            url: result.url,
            source: result.source,
            sourceId: result.sourceId,
            category: result.category,
            publishedAt: result.publishedAt,
            excerpt: result.excerpt,
            content: result.content || undefined,
            imageUrl: result.imageUrl || undefined,
            isProcessed: result.isProcessed,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    });
}
/**
 * 여러 뉴스 항목 저장 (중복 방지)
 */
function saveNewsItems(newsItems) {
    return __awaiter(this, void 0, void 0, function* () {
        let savedCount = 0;
        for (const item of newsItems) {
            // URL로 기존 항목 확인
            const existingItem = yield server_1.prisma.news.findFirst({
                where: {
                    url: item.url,
                },
            });
            if (!existingItem) {
                yield saveNewsItem(item);
                savedCount++;
            }
        }
        return savedCount;
    });
}
/**
 * 뉴스 항목 ID로 가져오기
 */
function getNewsById(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const newsItem = yield server_1.prisma.news.findUnique({
            where: { id }
        });
        if (!newsItem)
            return null;
        return newsItem;
    });
}
/**
 * 필터 조건에 맞는 뉴스 목록 가져오기
 */
function getNewsItems(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { categories, sources, keywords, startDate, endDate, limit = 50, offset = 0, } = options;
        // 필터 조건 구성
        const where = {};
        if (categories && categories.length > 0) {
            where.category = { in: categories };
        }
        if (sources && sources.length > 0) {
            where.sourceId = { in: sources };
        }
        if (keywords && keywords.length > 0) {
            where.OR = keywords.map(keyword => ({
                OR: [
                    { title: { contains: keyword, mode: 'insensitive' } },
                    { excerpt: { contains: keyword, mode: 'insensitive' } },
                    { content: { contains: keyword, mode: 'insensitive' } },
                ],
            }));
        }
        if (startDate || endDate) {
            where.publishedAt = {};
            if (startDate) {
                where.publishedAt.gte = startDate;
            }
            if (endDate) {
                where.publishedAt.lte = endDate;
            }
        }
        // 데이터 조회
        const newsItems = yield server_1.prisma.news.findMany({
            where,
            orderBy: { publishedAt: 'desc' },
            skip: offset,
            take: limit
        });
        // null을 undefined로 변환
        return newsItems.map(item => (Object.assign(Object.assign({}, item), { content: item.content || undefined, imageUrl: item.imageUrl || undefined })));
    });
}
/**
 * 카테고리별 최신 뉴스 가져오기
 */
function getLatestNewsByCategory(category_1) {
    return __awaiter(this, arguments, void 0, function* (category, limit = 10) {
        return yield server_1.prisma.news.findMany({
            where: { category },
            orderBy: { publishedAt: 'desc' },
            take: limit
        });
    });
}
/**
 * 뉴스 처리 상태 업데이트
 */
function updateNewsProcessingStatus(newsId, isProcessed) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield server_1.prisma.news.update({
                where: { id: newsId },
                data: { isProcessed }
            });
        }
        catch (error) {
            console.error('뉴스 처리 상태 업데이트 중 오류:', error);
            throw error;
        }
    });
}
/**
 * 처리되지 않은 뉴스 항목 조회
 */
function getUnprocessedNewsItems() {
    return __awaiter(this, arguments, void 0, function* (limit = 20) {
        try {
            const newsItems = yield server_1.prisma.news.findMany({
                where: { isProcessed: false },
                orderBy: { createdAt: 'desc' },
                take: limit
            });
            // null을 undefined로 변환
            return newsItems.map(item => (Object.assign(Object.assign({}, item), { content: item.content || undefined, imageUrl: item.imageUrl || undefined })));
        }
        catch (error) {
            console.error('처리되지 않은 뉴스 조회 중 오류:', error);
            return [];
        }
    });
}
/**
 * 뉴스 통계 가져오기
 */
function getNewsStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const totalNews = yield server_1.prisma.news.count();
        // 카테고리별 통계
        const categoryStats = yield server_1.prisma.news.groupBy({
            by: ['category'],
            _count: { id: true },
        });
        // 소스별 통계
        const sourceStats = yield server_1.prisma.news.groupBy({
            by: ['source'],
            _count: { id: true },
        });
        // 최신 업데이트 시간
        const latestNews = yield server_1.prisma.news.findFirst({
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });
        const newsByCategory = Object.fromEntries(categoryStats.map(stat => [stat.category, stat._count.id]));
        const newsBySource = Object.fromEntries(sourceStats.map(stat => [stat.source, stat._count.id]));
        return {
            totalNews,
            newsByCategory,
            newsBySource,
            latestUpdate: (latestNews === null || latestNews === void 0 ? void 0 : latestNews.createdAt) || new Date(),
        };
    });
}
function createNewsItem(newsData) {
    return __awaiter(this, void 0, void 0, function* () {
        const newsItem = yield server_1.prisma.news.create({
            data: newsData
        });
        // null을 undefined로 변환
        return Object.assign(Object.assign({}, newsItem), { content: newsItem.content || undefined, imageUrl: newsItem.imageUrl || undefined });
    });
}
function getNewsByCategory(category) {
    return __awaiter(this, void 0, void 0, function* () {
        const newsItems = yield server_1.prisma.news.findMany({
            where: { category },
            orderBy: { publishedAt: 'desc' },
            take: 50
        });
        // null을 undefined로 변환
        return newsItems.map(item => (Object.assign(Object.assign({}, item), { content: item.content || undefined, imageUrl: item.imageUrl || undefined })));
    });
}
function getLatestNews() {
    return __awaiter(this, arguments, void 0, function* (limit = 20) {
        const newsItems = yield server_1.prisma.news.findMany({
            orderBy: { publishedAt: 'desc' },
            take: limit
        });
        // null을 undefined로 변환
        return newsItems.map(item => (Object.assign(Object.assign({}, item), { content: item.content || undefined, imageUrl: item.imageUrl || undefined })));
    });
}
