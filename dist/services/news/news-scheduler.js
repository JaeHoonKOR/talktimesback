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
exports.fetchAndStoreAllNews = fetchAndStoreAllNews;
exports.fetchAndStoreCategoryNews = fetchAndStoreCategoryNews;
exports.cleanupOldNews = cleanupOldNews;
exports.fetchAndStoreAllCategories = fetchAndStoreAllCategories;
const server_1 = require("../../server");
const rss_service_1 = require("./rss-service");
const rss_sources_1 = require("./rss-sources");
/**
 * 모든 RSS 소스에서 뉴스를 가져와 데이터베이스에 저장하는 함수
 */
function fetchAndStoreAllNews() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('📰 모든 RSS 소스에서 뉴스를 가져오는 중... 📰');
            const newsItems = yield (0, rss_service_1.fetchAllNews)();
            console.log(`✅ 총 ${newsItems.length}개의 뉴스 항목을 수집했습니다.`);
            // 중복 제거
            const uniqueNews = (0, rss_service_1.deduplicateNews)(newsItems);
            console.log(`✅ 중복 제거 후 ${uniqueNews.length}개의 고유 뉴스 항목을 찾았습니다.`);
            console.log('🔄 데이터베이스에 저장 중...');
            // 데이터베이스에 저장
            let newCount = 0;
            let updateCount = 0;
            for (const item of uniqueNews) {
                // 이미 존재하는지 확인
                const existingNews = yield server_1.prisma.news.findUnique({
                    where: { url: item.url },
                });
                if (existingNews) {
                    // 이미 존재하는 경우 업데이트
                    yield server_1.prisma.news.update({
                        where: { id: existingNews.id },
                        data: {
                            title: item.title,
                            excerpt: item.excerpt,
                            content: item.content,
                            imageUrl: item.imageUrl,
                            updatedAt: new Date(),
                        },
                    });
                    updateCount++;
                }
                else {
                    // 존재하지 않는 경우 새로 생성
                    yield server_1.prisma.news.create({
                        data: {
                            id: item.id,
                            title: item.title,
                            url: item.url,
                            source: item.source,
                            sourceId: item.sourceId,
                            category: item.category,
                            publishedAt: item.publishedAt,
                            excerpt: item.excerpt,
                            content: item.content,
                            imageUrl: item.imageUrl,
                            isProcessed: false,
                        },
                    });
                    newCount++;
                }
            }
            console.log(`✅ 데이터베이스 저장 완료: ${newCount}개 추가, ${updateCount}개 업데이트`);
            return { total: uniqueNews.length, added: newCount, updated: updateCount };
        }
        catch (error) {
            console.error('❌ 뉴스 가져오기 및 저장 중 오류 발생:', error);
            throw error;
        }
    });
}
/**
 * 특정 카테고리의 RSS 소스에서 뉴스를 가져와 데이터베이스에 저장하는 함수
 */
function fetchAndStoreCategoryNews(category) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`📰 [${category}] 카테고리 뉴스를 가져오는 중... 📰`);
            const newsItems = yield (0, rss_service_1.fetchNewsByCategory)(category);
            console.log(`✅ [${category}] 총 ${newsItems.length}개의 뉴스 항목을 수집했습니다.`);
            // 중복 제거
            const uniqueNews = (0, rss_service_1.deduplicateNews)(newsItems);
            console.log(`✅ [${category}] 중복 제거 후 ${uniqueNews.length}개의 고유 뉴스 항목을 찾았습니다.`);
            console.log(`🔄 [${category}] 데이터베이스에 저장 중...`);
            // 데이터베이스에 저장
            let newCount = 0;
            let updateCount = 0;
            for (const item of uniqueNews) {
                // 이미 존재하는지 확인
                const existingNews = yield server_1.prisma.news.findUnique({
                    where: { url: item.url },
                });
                if (existingNews) {
                    // 이미 존재하는 경우 업데이트
                    yield server_1.prisma.news.update({
                        where: { id: existingNews.id },
                        data: {
                            title: item.title,
                            excerpt: item.excerpt,
                            content: item.content,
                            imageUrl: item.imageUrl,
                            updatedAt: new Date(),
                        },
                    });
                    updateCount++;
                }
                else {
                    // 존재하지 않는 경우 새로 생성
                    yield server_1.prisma.news.create({
                        data: {
                            id: item.id,
                            title: item.title,
                            url: item.url,
                            source: item.source,
                            sourceId: item.sourceId,
                            category: item.category,
                            publishedAt: item.publishedAt,
                            excerpt: item.excerpt,
                            content: item.content,
                            imageUrl: item.imageUrl,
                            isProcessed: false,
                        },
                    });
                    newCount++;
                }
            }
            console.log(`✅ [${category}] 데이터베이스 저장 완료: ${newCount}개 추가, ${updateCount}개 업데이트`);
            return { category, total: uniqueNews.length, added: newCount, updated: updateCount };
        }
        catch (error) {
            console.error(`❌ [${category}] 카테고리 뉴스 가져오기 및 저장 중 오류 발생:`, error);
            throw error;
        }
    });
}
/**
 * 7일 이상 지난 뉴스를 제거하는 함수
 */
function cleanupOldNews() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🧹 오래된 뉴스 정리 중...');
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            // 1. 먼저 삭제 대상이 되는 뉴스 ID들을 조회
            const oldNews = yield server_1.prisma.news.findMany({
                where: {
                    publishedAt: {
                        lt: oneWeekAgo,
                    },
                },
                select: {
                    id: true,
                },
            });
            if (oldNews.length === 0) {
                console.log('ℹ️ 삭제할 오래된 뉴스가 없습니다.');
                return 0;
            }
            const oldNewsIds = oldNews.map(news => news.id);
            // 2. 뉴스 삭제
            const { count: newsDeleted } = yield server_1.prisma.news.deleteMany({
                where: {
                    id: {
                        in: oldNewsIds,
                    },
                },
            });
            console.log(`✅ ${newsDeleted}개의 오래된 뉴스를 제거했습니다.`);
            return newsDeleted;
        }
        catch (error) {
            console.error('❌ 오래된 뉴스 제거 중 오류 발생:', error);
            throw error;
        }
    });
}
/**
 * 모든 카테고리의 뉴스를 차례로 가져오는 함수
 */
function fetchAndStoreAllCategories() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('📊 모든 카테고리의 뉴스 수집 작업을 시작합니다...');
        console.log('-----------------------------------------------------');
        const results = [];
        const categories = Object.values(rss_sources_1.CATEGORIES);
        let currentCategory = 1;
        for (const category of categories) {
            try {
                console.log(`\n[${currentCategory}/${categories.length}] ${category} 카테고리 처리 중...`);
                const result = yield fetchAndStoreCategoryNews(category);
                results.push(result);
                console.log(`✅ ${category} 카테고리 완료!\n`);
            }
            catch (error) {
                console.error(`❌ ${category} 카테고리 처리 중 오류 발생:`, error);
                results.push({ category, error: error.message });
            }
            currentCategory++;
        }
        // 결과 요약 표시
        console.log('-----------------------------------------------------');
        console.log('📊 뉴스 수집 결과 요약:');
        const totalAdded = results.reduce((sum, r) => sum + (('added' in r) ? r.added : 0), 0);
        const totalUpdated = results.reduce((sum, r) => sum + (('updated' in r) ? r.updated : 0), 0);
        const errorCount = results.filter(r => 'error' in r).length;
        console.log(`- 총 추가된 뉴스: ${totalAdded}개`);
        console.log(`- 총 업데이트된 뉴스: ${totalUpdated}개`);
        console.log(`- 오류 발생 카테고리: ${errorCount}개`);
        console.log('-----------------------------------------------------');
        return results;
    });
}
