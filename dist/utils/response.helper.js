"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPaginatedSuccess = exports.sendDeleted = exports.sendUpdated = exports.sendCreated = exports.sendInternalServerError = exports.sendConflict = exports.sendNotFound = exports.sendForbidden = exports.sendUnauthorized = exports.sendValidationError = exports.sendError = exports.sendSuccess = exports.ResponseHelper = void 0;
const api_types_1 = require("../types/api.types");
/**
 * 표준화된 API 응답 헬퍼 클래스
 */
class ResponseHelper {
    /**
     * 성공 응답 생성
     */
    static success(res, data, message, pagination) {
        const response = Object.assign({ success: true, data,
            message, timestamp: new Date().toISOString() }, (pagination && { pagination }));
        return res.status(200).json(response);
    }
    /**
     * 에러 응답 생성
     */
    static error(res, errorCode, message, details, field) {
        const error = Object.assign(Object.assign({ code: errorCode, message }, (details && { details })), (field && { field }));
        const response = {
            success: false,
            error,
            timestamp: new Date().toISOString()
        };
        const statusCode = api_types_1.ErrorCodeToHttpStatus[errorCode] || 500;
        return res.status(statusCode).json(response);
    }
    /**
     * 검증 오류 응답 생성
     */
    static validationError(res, message, field, details) {
        return this.error(res, api_types_1.ErrorCode.VALIDATION_ERROR, message, details, field);
    }
    /**
     * 인증 오류 응답 생성
     */
    static unauthorized(res, message = '인증이 필요합니다.') {
        return this.error(res, api_types_1.ErrorCode.UNAUTHORIZED, message);
    }
    /**
     * 권한 오류 응답 생성
     */
    static forbidden(res, message = '권한이 없습니다.') {
        return this.error(res, api_types_1.ErrorCode.FORBIDDEN, message);
    }
    /**
     * 리소스 없음 응답 생성
     */
    static notFound(res, message = '리소스를 찾을 수 없습니다.') {
        return this.error(res, api_types_1.ErrorCode.NOT_FOUND, message);
    }
    /**
     * 충돌 응답 생성
     */
    static conflict(res, message = '이미 존재하는 리소스입니다.') {
        return this.error(res, api_types_1.ErrorCode.CONFLICT, message);
    }
    /**
     * 내부 서버 오류 응답 생성
     */
    static internalServerError(res, message = '내부 서버 오류가 발생했습니다.', details) {
        return this.error(res, api_types_1.ErrorCode.INTERNAL_SERVER_ERROR, message, details);
    }
    /**
     * 외부 서비스 오류 응답 생성
     */
    static externalServiceError(res, message = '외부 서비스 오류가 발생했습니다.', details) {
        return this.error(res, api_types_1.ErrorCode.EXTERNAL_SERVICE_ERROR, message, details);
    }
    /**
     * 데이터베이스 오류 응답 생성
     */
    static databaseError(res, message = '데이터베이스 오류가 발생했습니다.', details) {
        return this.error(res, api_types_1.ErrorCode.DATABASE_ERROR, message, details);
    }
    /**
     * 생성 성공 응답 (201)
     */
    static created(res, data, message) {
        return this.success(res, data, message);
    }
    /**
     * 업데이트 성공 응답 (200)
     */
    static updated(res, data, message) {
        return this.success(res, data, message);
    }
    /**
     * 삭제 성공 응답 (204)
     */
    static deleted(res) {
        return res.status(204).send();
    }
    /**
     * 페이지네이션 메타데이터 생성
     */
    static createPaginationMeta(page, limit, total) {
        const totalPages = Math.ceil(total / limit);
        return {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        };
    }
    /**
     * 페이지네이션된 성공 응답
     */
    static paginatedSuccess(res, data, page, limit, total, statusCode = 200) {
        const pagination = this.createPaginationMeta(page, limit, total);
        return this.success(res, data, undefined, pagination);
    }
    /**
     * 잘못된 요청 응답 생성
     */
    static badRequest(res, message = '잘못된 요청입니다.', details) {
        return this.error(res, api_types_1.ErrorCode.VALIDATION_ERROR, message, details);
    }
}
exports.ResponseHelper = ResponseHelper;
/**
 * 에러 응답 헬퍼 함수들 (기존 코드와의 호환성을 위해)
 */
const sendSuccess = (res, data, statusCode = 200, pagination) => ResponseHelper.success(res, data, undefined, pagination);
exports.sendSuccess = sendSuccess;
const sendError = (res, errorCode, message, details, field) => ResponseHelper.error(res, errorCode, message, details, field);
exports.sendError = sendError;
const sendValidationError = (res, message, field, details) => ResponseHelper.validationError(res, message, field, details);
exports.sendValidationError = sendValidationError;
const sendUnauthorized = (res, message) => ResponseHelper.unauthorized(res, message);
exports.sendUnauthorized = sendUnauthorized;
const sendForbidden = (res, message) => ResponseHelper.forbidden(res, message);
exports.sendForbidden = sendForbidden;
const sendNotFound = (res, message) => ResponseHelper.notFound(res, message);
exports.sendNotFound = sendNotFound;
const sendConflict = (res, message) => ResponseHelper.conflict(res, message);
exports.sendConflict = sendConflict;
const sendInternalServerError = (res, message, details) => ResponseHelper.internalServerError(res, message, details);
exports.sendInternalServerError = sendInternalServerError;
const sendCreated = (res, data, message) => ResponseHelper.created(res, data, message);
exports.sendCreated = sendCreated;
const sendUpdated = (res, data, message) => ResponseHelper.updated(res, data, message);
exports.sendUpdated = sendUpdated;
const sendDeleted = (res) => ResponseHelper.deleted(res);
exports.sendDeleted = sendDeleted;
const sendPaginatedSuccess = (res, data, page, limit, total, statusCode = 200) => ResponseHelper.paginatedSuccess(res, data, page, limit, total, statusCode);
exports.sendPaginatedSuccess = sendPaginatedSuccess;
