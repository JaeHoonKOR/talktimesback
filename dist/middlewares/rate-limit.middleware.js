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
exports.translationRateLimiter = exports.authRateLimiter = exports.apiRateLimiter = void 0;
exports.rateLimiter = rateLimiter;
exports.userRateLimiter = userRateLimiter;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const error_handler_1 = require("../utils/error-handler");
const logger_1 = require("../utils/logger");
/**
 * 메모리 기반 속도 제한 미들웨어
 *
 * @param options 속도 제한 옵션
 */
function rateLimiter(options = {}) {
    const { points = 60, duration = 60, blockDuration = duration * 2, message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', pointsConsumed = 1 } = options;
    // 기본 키 생성 함수 (IP 주소 기반)
    const defaultKeyGenerator = (req) => {
        return req.ip || req.connection.remoteAddress || 'unknown';
    };
    const keyGenerator = options.keyGenerator || defaultKeyGenerator;
    // 메모리 기반 속도 제한기 생성
    const limiter = new rate_limiter_flexible_1.RateLimiterMemory({
        points,
        duration,
        blockDuration
    });
    return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        try {
            // 요청 키 생성
            const key = keyGenerator(req);
            // 속도 제한 검사
            yield limiter.consume(key, pointsConsumed);
            next();
        }
        catch (error) {
            // 속도 제한 초과 시
            if (error instanceof rate_limiter_flexible_1.RateLimiterRes) {
                const retryAfterSeconds = Math.ceil(error.msBeforeNext / 1000);
                logger_1.serverLogger.warn('속도 제한 초과', {
                    ip: req.ip,
                    path: req.originalUrl,
                    method: req.method,
                    retryAfter: retryAfterSeconds
                });
                // 응답 헤더 설정
                res.set({
                    'Retry-After': String(retryAfterSeconds),
                    'X-RateLimit-Limit': String(points),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(Date.now() + error.msBeforeNext)
                });
                next(new error_handler_1.AppError(error_handler_1.ErrorType.VALIDATION, message, true, true, null, {
                    retryAfter: retryAfterSeconds,
                    limit: points
                }));
            }
            else {
                // 기타 오류
                next(error);
            }
        }
    });
}
/**
 * API 요청 속도 제한 미들웨어 (분당 60회)
 */
exports.apiRateLimiter = rateLimiter({
    points: 60,
    duration: 60,
    message: 'API 요청이 너무 많습니다. 분당 최대 60회까지 요청할 수 있습니다.'
});
/**
 * 인증 요청 속도 제한 미들웨어 (분당 10회)
 */
exports.authRateLimiter = rateLimiter({
    points: 10,
    duration: 60,
    blockDuration: 300, // 5분 차단
    message: '인증 시도가 너무 많습니다. 5분 후에 다시 시도해주세요.'
});
/**
 * 번역 요청 속도 제한 미들웨어 (분당 30회)
 */
exports.translationRateLimiter = rateLimiter({
    points: 30,
    duration: 60,
    message: '번역 요청이 너무 많습니다. 분당 최대 30회까지 요청할 수 있습니다.'
});
/**
 * 사용자 ID 기반 속도 제한 미들웨어
 *
 * @param options 속도 제한 옵션
 */
function userRateLimiter(options = {}) {
    return rateLimiter(Object.assign(Object.assign({}, options), { keyGenerator: (req) => {
            var _a;
            // 사용자 ID 또는 IP 주소 사용
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            return userId ? `user:${userId}` : `ip:${req.ip}`;
        } }));
}
