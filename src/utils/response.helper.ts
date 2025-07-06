import { Response } from 'express';
import {
    ApiError,
    ApiResponse,
    ErrorCode,
    ErrorCodeToHttpStatus,
    PaginationMeta
} from '../types/api.types';

/**
 * 표준화된 API 응답 헬퍼 클래스
 */
export class ResponseHelper {
  /**
   * 성공 응답 생성
   */
  static success<T>(
    res: Response,
    data: T,
    message?: string,
    pagination?: PaginationMeta
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      ...(pagination && { pagination })
    };

    return res.status(200).json(response);
  }

  /**
   * 에러 응답 생성
   */
  static error(
    res: Response,
    errorCode: ErrorCode,
    message: string,
    details?: any,
    field?: string
  ): Response {
    const error: ApiError = {
      code: errorCode,
      message,
      ...(details && { details }),
      ...(field && { field })
    };

    const response: ApiResponse = {
      success: false,
      error,
      timestamp: new Date().toISOString()
    };

    const statusCode = ErrorCodeToHttpStatus[errorCode] || 500;
    return res.status(statusCode).json(response);
  }

  /**
   * 검증 오류 응답 생성
   */
  static validationError(
    res: Response,
    message: string,
    field?: string,
    details?: any
  ): Response {
    return this.error(res, ErrorCode.VALIDATION_ERROR, message, details, field);
  }

  /**
   * 인증 오류 응답 생성
   */
  static unauthorized(
    res: Response,
    message: string = '인증이 필요합니다.'
  ): Response {
    return this.error(res, ErrorCode.UNAUTHORIZED, message);
  }

  /**
   * 권한 오류 응답 생성
   */
  static forbidden(
    res: Response,
    message: string = '권한이 없습니다.'
  ): Response {
    return this.error(res, ErrorCode.FORBIDDEN, message);
  }

  /**
   * 리소스 없음 응답 생성
   */
  static notFound(
    res: Response,
    message: string = '리소스를 찾을 수 없습니다.'
  ): Response {
    return this.error(res, ErrorCode.NOT_FOUND, message);
  }

  /**
   * 충돌 응답 생성
   */
  static conflict(
    res: Response,
    message: string = '이미 존재하는 리소스입니다.'
  ): Response {
    return this.error(res, ErrorCode.CONFLICT, message);
  }

  /**
   * 내부 서버 오류 응답 생성
   */
  static internalServerError(
    res: Response,
    message: string = '내부 서버 오류가 발생했습니다.',
    details?: any
  ): Response {
    return this.error(res, ErrorCode.INTERNAL_SERVER_ERROR, message, details);
  }

  /**
   * 외부 서비스 오류 응답 생성
   */
  static externalServiceError(
    res: Response,
    message: string = '외부 서비스 오류가 발생했습니다.',
    details?: any
  ): Response {
    return this.error(res, ErrorCode.EXTERNAL_SERVICE_ERROR, message, details);
  }

  /**
   * 데이터베이스 오류 응답 생성
   */
  static databaseError(
    res: Response,
    message: string = '데이터베이스 오류가 발생했습니다.',
    details?: any
  ): Response {
    return this.error(res, ErrorCode.DATABASE_ERROR, message, details);
  }

  /**
   * 생성 성공 응답 (201)
   */
  static created<T>(
    res: Response,
    data: T,
    message?: string
  ): Response {
    return this.success(res, data, message);
  }

  /**
   * 업데이트 성공 응답 (200)
   */
  static updated<T>(
    res: Response,
    data: T,
    message?: string
  ): Response {
    return this.success(res, data, message);
  }

  /**
   * 삭제 성공 응답 (204)
   */
  static deleted(res: Response): Response {
    return res.status(204).send();
  }

  /**
   * 페이지네이션 메타데이터 생성
   */
  static createPaginationMeta(
    page: number,
    limit: number,
    total: number
  ): PaginationMeta {
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
  static paginatedSuccess<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    statusCode: number = 200
  ): Response {
    const pagination = this.createPaginationMeta(page, limit, total);
    
    return this.success(res, data, undefined, pagination);
  }

  /**
   * 잘못된 요청 응답 생성
   */
  static badRequest(
    res: Response,
    message: string = '잘못된 요청입니다.',
    details?: any
  ): Response {
    return this.error(res, ErrorCode.VALIDATION_ERROR, message, details);
  }
}

/**
 * 에러 응답 헬퍼 함수들 (기존 코드와의 호환성을 위해)
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  pagination?: PaginationMeta
) => ResponseHelper.success(res, data, undefined, pagination);

export const sendError = (
  res: Response,
  errorCode: ErrorCode,
  message: string,
  details?: any,
  field?: string
) => ResponseHelper.error(res, errorCode, message, details, field);

export const sendValidationError = (
  res: Response,
  message: string,
  field?: string,
  details?: any
) => ResponseHelper.validationError(res, message, field, details);

export const sendUnauthorized = (
  res: Response,
  message?: string
) => ResponseHelper.unauthorized(res, message);

export const sendForbidden = (
  res: Response,
  message?: string
) => ResponseHelper.forbidden(res, message);

export const sendNotFound = (
  res: Response,
  message?: string
) => ResponseHelper.notFound(res, message);

export const sendConflict = (
  res: Response,
  message?: string
) => ResponseHelper.conflict(res, message);

export const sendInternalServerError = (
  res: Response,
  message?: string,
  details?: any
) => ResponseHelper.internalServerError(res, message, details);

export const sendCreated = <T>(
  res: Response,
  data: T,
  message?: string
) => ResponseHelper.created(res, data, message);

export const sendUpdated = <T>(
  res: Response,
  data: T,
  message?: string
) => ResponseHelper.updated(res, data, message);

export const sendDeleted = (res: Response) => ResponseHelper.deleted(res);

export const sendPaginatedSuccess = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  statusCode: number = 200
) => ResponseHelper.paginatedSuccess(res, data, page, limit, total, statusCode); 