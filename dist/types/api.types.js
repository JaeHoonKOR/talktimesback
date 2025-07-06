"use strict";
/**
 * 표준화된 API 응답 타입 정의
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodeToHttpStatus = exports.ErrorCode = void 0;
// 에러 코드 열거형
var ErrorCode;
(function (ErrorCode) {
    // 일반 오류
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    ErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorCode["SYSTEM_ERROR"] = "SYSTEM_ERROR";
    // 인증/권한 오류
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["INVALID_TOKEN"] = "INVALID_TOKEN";
    // 검증 오류
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    // 리소스 오류
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["ALREADY_EXISTS"] = "ALREADY_EXISTS";
    ErrorCode["CONFLICT"] = "CONFLICT";
    // 외부 서비스 오류
    ErrorCode["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["TRANSLATION_SERVICE_ERROR"] = "TRANSLATION_SERVICE_ERROR";
    // 비즈니스 로직 오류
    ErrorCode["INVALID_OPERATION"] = "INVALID_OPERATION";
    ErrorCode["QUOTA_EXCEEDED"] = "QUOTA_EXCEEDED";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
// HTTP 상태 코드 매핑
exports.ErrorCodeToHttpStatus = {
    [ErrorCode.UNKNOWN_ERROR]: 500,
    [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
    [ErrorCode.SYSTEM_ERROR]: 500,
    [ErrorCode.UNAUTHORIZED]: 401,
    [ErrorCode.FORBIDDEN]: 403,
    [ErrorCode.TOKEN_EXPIRED]: 401,
    [ErrorCode.INVALID_TOKEN]: 401,
    [ErrorCode.VALIDATION_ERROR]: 400,
    [ErrorCode.INVALID_INPUT]: 400,
    [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.ALREADY_EXISTS]: 409,
    [ErrorCode.CONFLICT]: 409,
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
    [ErrorCode.DATABASE_ERROR]: 503,
    [ErrorCode.TRANSLATION_SERVICE_ERROR]: 502,
    [ErrorCode.INVALID_OPERATION]: 400,
    [ErrorCode.QUOTA_EXCEEDED]: 429,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429
};
