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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERBOSE_LOGGING = void 0;
exports.setupNewsCronJobs = setupNewsCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const server_1 = require("../../server");
const cache_manager_1 = require("../translation/cache-manager");
const news_scheduler_1 = require("./news-scheduler");
// 로깅 레벨 설정 (true: 자세한 로그, false: 간결한 로그)
exports.VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';
// 번역 캐시 관리자 인스턴스
const cacheManager = new cache_manager_1.TranslationCacheManager();
// 데이터베이스 연결 상태 추적
let isDatabaseConnected = false;
/**
 * 오늘 이미 뉴스가 수집되었는지 확인하는 함수
 */
function hasCollectedNewsToday() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isDatabaseConnected) {
            console.log('ℹ️ [시스템] 데이터베이스 연결이 없어 수집 확인을 건너뜁니다.');
            return true; // 연결 없으면 이미 수집된 것으로 간주
        }
        try {
            // 오늘 날짜의 시작과 끝 설정
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            // 오늘 추가된 뉴스 확인
            const todayNewsCount = yield server_1.prisma.news.count({
                where: {
                    createdAt: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            });
            return todayNewsCount > 0;
        }
        catch (error) {
            console.error(`[오류] 오늘 수집 확인 중 문제 발생:`, error);
            isDatabaseConnected = false; // 오류 발생 시 연결 상태 업데이트
            return true; // 오류 발생 시 수집 안함 (true 반환)
        }
    });
}
/**
 * 데이터베이스 연결을 확인하는 함수
 * prepared statement 오류를 방지하기 위해 트랜잭션 방식 사용
 */
function checkDatabaseConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // $executeRaw 사용하여 연결 확인 (prepared statement 문제 방지)
            yield server_1.prisma.$executeRaw `SELECT 1 AS connection_test`;
            isDatabaseConnected = true;
            return true;
        }
        catch (error) {
            console.error(`[오류] 데이터베이스 연결 확인 실패:`, error);
            isDatabaseConnected = false;
            return false;
        }
    });
}
/**
 * 작업 실행 전 데이터베이스 연결 확인 래퍼 함수
 */
function withDatabaseConnection(taskName, task) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isDatabaseConnected) {
            // 작업 전 데이터베이스 연결 재확인
            const isConnected = yield checkDatabaseConnection();
            if (!isConnected) {
                console.log(`ℹ️ [시스템] 데이터베이스 연결이 없어 ${taskName} 작업을 건너뜁니다.`);
                return null;
            }
        }
        return task();
    });
}
/**
 * RSS 뉴스 수집 및 처리를 위한 cron 작업 설정
 */
function setupNewsCronJobs() {
    // 서버 시작 시 데이터베이스 연결 상태 확인
    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        try {
            // 데이터베이스 연결 확인
            isDatabaseConnected = yield checkDatabaseConnection();
            if (!isDatabaseConnected) {
                console.error(`❌ [오류] 데이터베이스 연결에 실패했습니다. 초기 뉴스 수집 및 cron 작업이 비활성화됩니다.`);
                return;
            }
            // 초기 뉴스 수집 로직 실행
            yield runInitialNewsCollection();
        }
        catch (dbError) {
            console.error(`❌ [오류] 데이터베이스 연결 확인 중 오류 발생:`, dbError);
            isDatabaseConnected = false;
        }
    }), 5000);
    // 매 시간마다 모든 카테고리의 뉴스 가져오기 (0분에 실행)
    node_cron_1.default.schedule('0 4 * * *', () => __awaiter(this, void 0, void 0, function* () {
        yield withDatabaseConnection('정기 뉴스 수집', () => __awaiter(this, void 0, void 0, function* () {
            console.log(`\n⏰ [${new Date().toISOString()}] 정기 뉴스 수집 작업 시작 ⏰`);
            console.log('===========================================================');
            try {
                const results = yield (0, news_scheduler_1.fetchAndStoreAllCategories)();
                console.log('===========================================================');
                console.log(`✅ [${new Date().toISOString()}] 정기 뉴스 수집 작업 완료!`);
                if (!exports.VERBOSE_LOGGING) {
                    const totalAdded = results.reduce((sum, r) => sum + (('added' in r) ? r.added : 0), 0);
                    const totalUpdated = results.reduce((sum, r) => sum + (('updated' in r) ? r.updated : 0), 0);
                    const errorCount = results.filter(r => 'error' in r).length;
                    console.log(`[뉴스 수집 요약] 추가: ${totalAdded}개, 업데이트: ${totalUpdated}개, 오류: ${errorCount}개`);
                }
            }
            catch (error) {
                console.error(`❌ [${new Date().toISOString()}] 정기 뉴스 수집 작업 중 오류 발생:`, error);
                console.log('===========================================================');
                // 심각한 오류 발생 시 연결 상태 재확인
                isDatabaseConnected = false;
            }
        }));
    }));
    // 매일 오전 3시에 오래된 뉴스 정리
    node_cron_1.default.schedule('0 3 * * *', () => __awaiter(this, void 0, void 0, function* () {
        yield withDatabaseConnection('오래된 뉴스 정리', () => __awaiter(this, void 0, void 0, function* () {
            console.log(`\n🧹 [${new Date().toISOString()}] 오래된 뉴스 정리 작업 시작...`);
            try {
                const count = yield (0, news_scheduler_1.cleanupOldNews)();
                console.log(`✅ [${new Date().toISOString()}] 오래된 뉴스 정리 작업 완료: ${count}개 제거`);
            }
            catch (error) {
                console.error(`❌ [오래된 뉴스 정리 오류] ${error instanceof Error ? error.message : String(error)}`);
                // 심각한 오류 발생 시 연결 상태 재확인
                isDatabaseConnected = false;
            }
        }));
    }));
    // 매일 오전 2시에 번역 캐시 정리
    node_cron_1.default.schedule('0 2 * * *', () => __awaiter(this, void 0, void 0, function* () {
        yield withDatabaseConnection('번역 캐시 정리', () => __awaiter(this, void 0, void 0, function* () {
            console.log(`\n🧹 [${new Date().toISOString()}] 번역 캐시 정리 작업 시작...`);
            try {
                const deletedCount = yield cacheManager.cleanupOldTranslations(30); // 30일 이상 미사용
                console.log(`✅ [${new Date().toISOString()}] 번역 캐시 정리 작업 완료: ${deletedCount}개 제거`);
                // 캐시 상태 로깅
                const cacheStatus = yield cacheManager.getCacheStatus();
                console.log(`📊 번역 캐시 현황: 총 ${cacheStatus.totalTranslations}개, 크기: ${cacheStatus.cacheSize}MB, 히트율: ${cacheStatus.hitRate}%`);
            }
            catch (error) {
                console.error(`❌ [번역 캐시 정리 오류] ${error instanceof Error ? error.message : String(error)}`);
                // 심각한 오류 발생 시 연결 상태 재확인
                isDatabaseConnected = false;
            }
        }));
    }));
    console.log('🔄 [시스템] 뉴스 관련 cron 작업 설정 완료');
    console.log('📅 스케줄: 매일 04:00 뉴스 수집, 03:00 뉴스 정리, 02:00 번역 캐시 정리');
}
/**
 * 초기 뉴스 수집 실행 함수
 */
function runInitialNewsCollection() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`\n🚀 [${new Date().toISOString()}] 서버 시작 시 뉴스 수집 작업 시작...`);
        console.log('===========================================================');
        // 오늘 이미 뉴스가 수집되었는지 확인
        const alreadyCollectedToday = yield hasCollectedNewsToday();
        if (alreadyCollectedToday) {
            console.log(`ℹ️ [시스템] 오늘 이미 뉴스가 수집되었습니다. 초기 수집 작업을 건너뜁니다.`);
            return;
        }
        // 1. 오래된 뉴스 제거
        try {
            const count = yield (0, news_scheduler_1.cleanupOldNews)();
            console.log(`✅ 오래된 뉴스 제거 완료: ${count}개 제거`);
        }
        catch (cleanupError) {
            console.error(`❌ [오류] 오래된 뉴스 제거 실패:`, cleanupError);
            // 심각한 오류 발생 시 연결 상태 재확인
            const isStillConnected = yield checkDatabaseConnection();
            if (!isStillConnected) {
                console.error(`❌ [오류] 데이터베이스 연결이 끊겼습니다. 초기 뉴스 수집을 중단합니다.`);
                return;
            }
        }
        // 2. 새 뉴스 수집
        try {
            const results = yield (0, news_scheduler_1.fetchAndStoreAllCategories)();
            console.log('===========================================================');
            console.log(`✅ [${new Date().toISOString()}] 서버 시작 시 뉴스 수집 작업 완료!`);
            const totalAdded = results.reduce((sum, r) => sum + (('added' in r) ? r.added : 0), 0);
            const totalUpdated = results.reduce((sum, r) => sum + (('updated' in r) ? r.updated : 0), 0);
            const errorCount = results.filter(r => 'error' in r).length;
            console.log(`[뉴스 수집 요약] 추가: ${totalAdded}개, 업데이트: ${totalUpdated}개, 오류: ${errorCount}개`);
        }
        catch (fetchError) {
            console.error(`❌ [오류] 뉴스 수집 실패:`, fetchError);
            console.log('===========================================================');
            // 심각한 오류 발생 시 연결 상태 재확인
            isDatabaseConnected = false;
        }
    });
}
