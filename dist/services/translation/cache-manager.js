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
exports.TranslationCacheManager = void 0;
const server_1 = require("../../server");
/**
 * 번역 캐시 관리 서비스
 */
class TranslationCacheManager {
    /**
     * 오래된 번역 정리 (기본: 30일 이상 미사용)
     */
    cleanupOldTranslations() {
        return __awaiter(this, arguments, void 0, function* (daysThreshold = 30) {
            try {
                const threshold = new Date();
                threshold.setDate(threshold.getDate() - daysThreshold);
                const { count } = yield server_1.prisma.translation.deleteMany({
                    where: {
                        AND: [
                            {
                                lastUsedAt: {
                                    lt: threshold
                                }
                            },
                            {
                                usageCount: {
                                    lt: 10 // 사용 빈도가 낮은 것만 삭제
                                }
                            }
                        ]
                    }
                });
                console.log(`🧹 ${count}개의 오래된 번역 캐시를 정리했습니다.`);
                return count;
            }
            catch (error) {
                console.error('번역 캐시 정리 중 오류:', error);
                return 0;
            }
        });
    }
    /**
     * 번역 통계 조회
     */
    getTranslationStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const totalCount = yield server_1.prisma.translation.count();
                const languageStats = yield server_1.prisma.translation.groupBy({
                    by: ['targetLang'],
                    _count: {
                        id: true
                    },
                    _avg: {
                        usageCount: true
                    }
                });
                return {
                    totalTranslations: totalCount,
                    languageStats: languageStats.map(stat => ({
                        targetLang: stat.targetLang,
                        _count: stat._count.id,
                        _avg: {
                            usageCount: stat._avg.usageCount || 0
                        }
                    }))
                };
            }
            catch (error) {
                console.error('번역 통계 조회 중 오류:', error);
                return {
                    totalTranslations: 0,
                    languageStats: []
                };
            }
        });
    }
    /**
     * 캐시 히트율 계산
     */
    calculateCacheHitRate() {
        return __awaiter(this, arguments, void 0, function* (days = 7) {
            try {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                // 최근 사용된 번역 중 사용 횟수가 1보다 큰 것들 (캐시 히트)
                const cacheHits = yield server_1.prisma.translation.count({
                    where: {
                        AND: [
                            {
                                lastUsedAt: {
                                    gte: startDate
                                }
                            },
                            {
                                usageCount: {
                                    gt: 1
                                }
                            }
                        ]
                    }
                });
                // 전체 사용된 번역
                const totalUsage = yield server_1.prisma.translation.count({
                    where: {
                        lastUsedAt: {
                            gte: startDate
                        }
                    }
                });
                if (totalUsage === 0)
                    return 0;
                return (cacheHits / totalUsage) * 100;
            }
            catch (error) {
                console.error('캐시 히트율 계산 중 오류:', error);
                return 0;
            }
        });
    }
    /**
     * 자주 사용되는 번역 조회
     */
    getPopularTranslations() {
        return __awaiter(this, arguments, void 0, function* (limit = 10) {
            try {
                return yield server_1.prisma.translation.findMany({
                    orderBy: {
                        usageCount: 'desc'
                    },
                    take: limit,
                    select: {
                        sourceText: true,
                        targetLang: true,
                        translatedText: true,
                        usageCount: true,
                        lastUsedAt: true
                    }
                });
            }
            catch (error) {
                console.error('인기 번역 조회 중 오류:', error);
                return [];
            }
        });
    }
    /**
     * 언어별 번역 사용량 조회
     */
    getLanguageUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield server_1.prisma.translation.groupBy({
                    by: ['targetLang'],
                    _sum: {
                        usageCount: true
                    },
                    _count: {
                        id: true
                    },
                    orderBy: {
                        _sum: {
                            usageCount: 'desc'
                        }
                    }
                });
            }
            catch (error) {
                console.error('언어별 사용량 조회 중 오류:', error);
                return [];
            }
        });
    }
    /**
     * 번역 캐시 크기 조회 (MB)
     */
    getCacheSize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield server_1.prisma.$queryRaw `
        SELECT pg_total_relation_size('Translation') as size
      `;
                if (result.length > 0) {
                    // bytes를 MB로 변환
                    return Number(result[0].size) / (1024 * 1024);
                }
                return 0;
            }
            catch (error) {
                console.error('캐시 크기 조회 중 오류:', error);
                return 0;
            }
        });
    }
    /**
     * 번역 캐시 상태 종합 조회
     */
    getCacheStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [stats, cacheSize, hitRate, languageUsage, popularTranslations] = yield Promise.all([
                    this.getTranslationStats(),
                    this.getCacheSize(),
                    this.calculateCacheHitRate(),
                    this.getLanguageUsage(),
                    this.getPopularTranslations(5)
                ]);
                return {
                    totalTranslations: stats.totalTranslations,
                    cacheSize: Math.round(cacheSize * 100) / 100, // 소수점 2자리
                    hitRate: Math.round(hitRate * 100) / 100,
                    languageBreakdown: languageUsage,
                    popularTranslations
                };
            }
            catch (error) {
                console.error('캐시 상태 조회 중 오류:', error);
                return {
                    totalTranslations: 0,
                    cacheSize: 0,
                    hitRate: 0,
                    languageBreakdown: [],
                    popularTranslations: []
                };
            }
        });
    }
    /**
     * 특정 언어의 번역 삭제
     */
    clearTranslationsByLanguage(targetLang) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { count } = yield server_1.prisma.translation.deleteMany({
                    where: {
                        targetLang
                    }
                });
                console.log(`🗑️ ${targetLang} 언어의 ${count}개 번역을 삭제했습니다.`);
                return count;
            }
            catch (error) {
                console.error(`${targetLang} 번역 삭제 중 오류:`, error);
                return 0;
            }
        });
    }
    /**
     * 전체 번역 캐시 초기화
     */
    clearAllTranslations() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { count } = yield server_1.prisma.translation.deleteMany({});
                console.log(`🗑️ 전체 ${count}개의 번역 캐시를 초기화했습니다.`);
                return count;
            }
            catch (error) {
                console.error('번역 캐시 초기화 중 오류:', error);
                return 0;
            }
        });
    }
}
exports.TranslationCacheManager = TranslationCacheManager;
