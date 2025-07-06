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
exports.BatchProcessor = void 0;
exports.processBatch = processBatch;
exports.processInChunks = processInChunks;
const logger_1 = __importDefault(require("./logger"));
/**
 * 배치 처리기 클래스
 * 대량의 아이템을 효율적으로 병렬 처리하기 위한 유틸리티
 */
class BatchProcessor {
    /**
     * 항목 배열을 병렬로 처리
     *
     * @param items 처리할 항목 배열
     * @param processor 각 항목을 처리하는 비동기 함수
     * @param options 배치 처리 옵션
     * @returns 배치 처리 결과
     */
    static process(items_1, processor_1) {
        return __awaiter(this, arguments, void 0, function* (items, processor, options = {}) {
            const startTime = Date.now();
            const { concurrency = 5, retryCount = 3, timeoutMs = 30000, retryDelayMs = 1000, onProgress, continueOnError = false } = options;
            // 결과 저장용 배열 및 맵 초기화
            const results = new Array(items.length).fill(null);
            const itemsMap = new Map();
            // 작업 진행 상태 추적
            let completed = 0;
            const total = items.length;
            // 빈 배열이 입력된 경우 즉시 반환
            if (total === 0) {
                return {
                    results: [],
                    successful: [],
                    itemsMap,
                    total: 0,
                    successCount: 0,
                    failureCount: 0,
                    totalTimeMs: 0
                };
            }
            logger_1.default.debug(`배치 처리 시작: ${total}개 항목, 동시성: ${concurrency}`);
            // 작업 처리 함수 (재시도 로직 포함)
            const processWithRetry = (item, index) => __awaiter(this, void 0, void 0, function* () {
                let currentRetry = 0;
                let success = false;
                let result;
                let error;
                while (currentRetry <= retryCount && !success) {
                    try {
                        // 타임아웃 래핑
                        result = yield Promise.race([
                            processor(item),
                            new Promise((_, reject) => {
                                setTimeout(() => {
                                    reject(new Error(`항목 처리 시간 초과 (${timeoutMs}ms)`));
                                }, timeoutMs);
                            })
                        ]);
                        success = true;
                    }
                    catch (err) {
                        error = err instanceof Error ? err : new Error(String(err));
                        if (currentRetry < retryCount) {
                            logger_1.default.debug(`항목 처리 실패, 재시도 중 (${currentRetry + 1}/${retryCount}): ${error.message}`);
                            // 재시도 전 지연
                            yield new Promise(resolve => setTimeout(resolve, retryDelayMs));
                            currentRetry++;
                        }
                        else {
                            logger_1.default.warn(`항목 처리 최종 실패: ${error.message}`);
                        }
                    }
                }
                // 결과 저장
                const itemResult = {
                    success,
                    result,
                    error,
                    retryCount: currentRetry
                };
                results[index] = itemResult;
                itemsMap.set(item, itemResult);
                // 진행 상황 업데이트
                completed++;
                if (onProgress) {
                    onProgress(completed, total);
                }
                if (completed % Math.max(1, Math.floor(total / 10)) === 0 || completed === total) {
                    logger_1.default.debug(`배치 처리 진행 상황: ${completed}/${total} (${Math.round(completed / total * 100)}%)`);
                }
                // 에러 발생 & continueOnError가 false인 경우 예외 발생
                if (!success && !continueOnError) {
                    throw error;
                }
            });
            try {
                // 작업 큐 생성 및 처리
                const queue = items.map((item, index) => ({ item, index }));
                // 처리할 작업이 남아있는 동안 반복
                while (queue.length > 0) {
                    // 현재 배치 크기 결정 (남은 항목과 동시성 중 작은 값)
                    const batchSize = Math.min(concurrency, queue.length);
                    const batch = queue.splice(0, batchSize);
                    // 현재 배치의 모든 작업을 병렬로 처리
                    const promises = batch.map(({ item, index }) => {
                        return processWithRetry(item, index).catch(error => {
                            if (!continueOnError) {
                                throw error;
                            }
                        });
                    });
                    // 모든 작업이 완료될 때까지 대기
                    yield Promise.all(promises);
                }
                // 성공/실패 항목 계산
                const successCount = results.filter(r => r.success).length;
                const failureCount = total - successCount;
                const successful = results
                    .filter(r => r.success && r.result !== undefined)
                    .map(r => r.result);
                const totalTimeMs = Date.now() - startTime;
                logger_1.default.debug(`배치 처리 완료: ${successCount}/${total} 성공, ${failureCount} 실패, ${totalTimeMs}ms 소요`);
                return {
                    results,
                    successful,
                    itemsMap,
                    total,
                    successCount,
                    failureCount,
                    totalTimeMs
                };
            }
            catch (error) {
                logger_1.default.error('배치 처리 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
                throw error;
            }
        });
    }
    /**
     * 항목들을 청크(덩어리)로 나누어 처리
     * 각 청크는 순차적으로 처리되지만, 청크 내의 항목들은 병렬로 처리됨
     *
     * @param items 처리할 항목 배열
     * @param processor 각 항목을 처리하는 비동기 함수
     * @param chunkSize 각 청크의 크기
     * @param options 배치 처리 옵션
     */
    static processInChunks(items_1, processor_1, chunkSize_1) {
        return __awaiter(this, arguments, void 0, function* (items, processor, chunkSize, options = {}) {
            const startTime = Date.now();
            const chunks = [];
            // 항목들을 청크로 분할
            for (let i = 0; i < items.length; i += chunkSize) {
                chunks.push(items.slice(i, i + chunkSize));
            }
            logger_1.default.debug(`청크 처리 시작: ${items.length}개 항목, ${chunks.length}개 청크`);
            const allResults = [];
            const itemsMap = new Map();
            let successCount = 0;
            let failureCount = 0;
            // 각 청크를 순차적으로 처리
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                logger_1.default.debug(`청크 ${i + 1}/${chunks.length} 처리 중 (${chunk.length}개 항목)`);
                const chunkResult = yield this.process(chunk, processor, options);
                // 결과 병합
                allResults.push(...chunkResult.results);
                chunkResult.itemsMap.forEach((value, key) => {
                    itemsMap.set(key, value);
                });
                successCount += chunkResult.successCount;
                failureCount += chunkResult.failureCount;
                logger_1.default.debug(`청크 ${i + 1}/${chunks.length} 완료: ${chunkResult.successCount}/${chunk.length} 성공`);
            }
            const totalTimeMs = Date.now() - startTime;
            logger_1.default.debug(`청크 처리 완료: ${successCount}/${items.length} 성공, ${totalTimeMs}ms 소요`);
            return {
                results: allResults,
                successful: allResults
                    .filter(r => r.success && r.result !== undefined)
                    .map(r => r.result),
                itemsMap,
                total: items.length,
                successCount,
                failureCount,
                totalTimeMs
            };
        });
    }
}
exports.BatchProcessor = BatchProcessor;
/**
 * 배치 처리 유틸리티 함수
 *
 * @param items 처리할 항목 배열
 * @param processor 각 항목을 처리하는 비동기 함수
 * @param options 배치 처리 옵션
 */
function processBatch(items_1, processor_1) {
    return __awaiter(this, arguments, void 0, function* (items, processor, options = {}) {
        return BatchProcessor.process(items, processor, options);
    });
}
/**
 * 청크 단위 배치 처리 유틸리티 함수
 *
 * @param items 처리할 항목 배열
 * @param processor 각 항목을 처리하는 비동기 함수
 * @param chunkSize 각 청크의 크기
 * @param options 배치 처리 옵션
 */
function processInChunks(items_1, processor_1, chunkSize_1) {
    return __awaiter(this, arguments, void 0, function* (items, processor, chunkSize, options = {}) {
        return BatchProcessor.processInChunks(items, processor, chunkSize, options);
    });
}
