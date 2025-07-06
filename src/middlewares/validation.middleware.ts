import { NextFunction, Request, Response } from 'express';
import { body, param, query, ValidationChain, validationResult } from 'express-validator';
import { ResponseHelper } from '../utils/response.helper';

/**
 * 검증 결과를 처리하는 미들웨어
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    
    ResponseHelper.validationError(
      res,
      firstError.msg,
      (firstError as any).param || 'field',
      errors.array()
    );
    return;
  }
  
  next();
};

/**
 * 공통 검증 규칙
 */
export class ValidationRules {
  // ID 검증
  static id(paramName: string = 'id'): ValidationChain[] {
    return [param(paramName)
      .notEmpty()
      .withMessage(`${paramName}은 필수입니다.`)
      .isString()
      .withMessage(`유효한 ${paramName}을 입력해주세요.`)];
  }

  // 페이지네이션 검증
  static pagination(): ValidationChain[] {
    return [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('페이지는 1 이상의 정수여야 합니다.'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('한 페이지당 항목 수는 1-100 사이여야 합니다.')
    ];
  }

  // 커서 기반 페이지네이션 검증
  static cursorPagination(): ValidationChain[] {
    return [
      query('cursor')
        .optional()
        .isString()
        .withMessage('커서는 문자열이어야 합니다.'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('한 페이지당 항목 수는 1-100 사이여야 합니다.')
    ];
  }

  // 정렬 검증
  static sorting(allowedFields: string[]): ValidationChain[] {
    return [
      query('sortBy')
        .optional()
        .isIn(allowedFields)
        .withMessage(`정렬 필드는 다음 중 하나여야 합니다: ${allowedFields.join(', ')}`),
      query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('정렬 순서는 asc 또는 desc여야 합니다.')
    ];
  }

  // 날짜 범위 검증
  static dateRange(): ValidationChain[] {
    return [
      query('startDate')
        .optional()
        .isISO8601()
        .withMessage('시작 날짜는 유효한 ISO8601 형식이어야 합니다.'),
      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('종료 날짜는 유효한 ISO8601 형식이어야 합니다.')
    ];
  }

  // 검색 검증
  static search(): ValidationChain[] {
    return [
      query('search')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('검색어는 1-100자 사이여야 합니다.')
        .trim()
    ];
  }

  // 언어 코드 검증
  static languageCode(): ValidationChain {
    return param('lang')
      .notEmpty()
      .withMessage('언어 코드는 필수입니다.')
      .isLength({ min: 2, max: 5 })
      .withMessage('언어 코드는 2-5자 사이여야 합니다.');
  }

  // 카테고리 검증
  static category(): ValidationChain {
    return query('category')
      .optional()
      .isIn(['politics', 'economy', 'society', 'culture', 'world', 'sports', 'entertainment', 'tech'])
      .withMessage('유효한 카테고리가 아닙니다.');
  }

  // 텍스트 길이 검증
  static textLength(maxLength: number = 1000): ValidationChain {
    return body('text')
      .notEmpty()
      .withMessage('텍스트는 필수입니다.')
      .isLength({ min: 1, max: maxLength })
      .withMessage(`텍스트는 1-${maxLength}자 사이여야 합니다.`);
  }
}

/**
 * 뉴스 관련 검증
 */
export class NewsValidation {
  // 뉴스 목록 조회 검증
  static getNewsList(): ValidationChain[] {
    return [
      ...ValidationRules.pagination(),
      ...ValidationRules.sorting(['createdAt', 'publishedAt', 'title']),
      ...ValidationRules.dateRange(),
      ...ValidationRules.search(),
      ValidationRules.category(),
      query('sources')
        .optional()
        .custom((value) => {
          if (typeof value === 'string') {
            return value.split(',').every(source => source.trim().length > 0);
          }
          if (Array.isArray(value)) {
            return value.every(source => typeof source === 'string' && source.trim().length > 0);
          }
          return true; // 빈 값은 허용
        })
        .withMessage('소스는 유효한 문자열 배열이어야 합니다.')
    ];
  }

  // 뉴스 목록 조회 검증 (커서 기반 페이지네이션)
  static getNewsListCursor(): ValidationChain[] {
    return [
      ...ValidationRules.cursorPagination(),
      ...ValidationRules.sorting(['createdAt', 'publishedAt', 'title']),
      ...ValidationRules.dateRange(),
      ...ValidationRules.search(),
      ValidationRules.category(),
      query('personalized')
        .optional()
        .isBoolean()
        .withMessage('personalized는 boolean 값이어야 합니다.'),
      query('sort')
        .optional()
        .isIn(['latest', 'popular', 'relevance'])
        .withMessage('정렬 방식은 latest, popular, relevance 중 하나여야 합니다.'),
      query('sources')
        .optional()
        .custom((value) => {
          if (typeof value === 'string') {
            return value.split(',').every(source => source.trim().length > 0);
          }
          if (Array.isArray(value)) {
            return value.every(source => typeof source === 'string' && source.trim().length > 0);
          }
          return true; // 빈 값은 허용
        })
        .withMessage('소스는 유효한 문자열 배열이어야 합니다.')
    ];
  }

  // 뉴스 검색 검증
  static searchNews(): ValidationChain[] {
    return [
      query('keywords')
        .notEmpty()
        .withMessage('키워드는 필수입니다.')
        .custom((value) => {
          if (typeof value === 'string') {
            const keywords = value.split(',').map(k => k.trim()).filter(k => k.length > 0);
            return keywords.length > 0 && keywords.length <= 10;
          }
          if (Array.isArray(value)) {
            return value.length > 0 && value.length <= 10 && 
                   value.every(k => typeof k === 'string' && k.trim().length > 0);
          }
          return false;
        })
        .withMessage('키워드는 1-10개의 유효한 문자열이어야 합니다.'),
      ...ValidationRules.pagination(),
      ...ValidationRules.sorting(['createdAt', 'publishedAt', 'title']),
      ValidationRules.category()
    ];
  }

  // 뉴스 ID 검증
  static getNewsById(): ValidationChain[] {
    return ValidationRules.id();
  }

  // 카테고리별 뉴스 검증
  static getNewsByCategory(): ValidationChain[] {
    return [
      param('category')
        .notEmpty()
        .withMessage('카테고리는 필수입니다.')
        .isIn(['politics', 'economy', 'society', 'culture', 'world', 'sports', 'entertainment', 'tech'])
        .withMessage('유효한 카테고리가 아닙니다.'),
      ...ValidationRules.pagination()
    ];
  }

  static createNews(): ValidationChain[] {
    return [
      body('title')
        .notEmpty()
        .withMessage('제목은 필수입니다.')
        .isLength({ min: 1, max: 500 })
        .withMessage('제목은 1-500자 사이여야 합니다.'),
      
      body('content')
        .notEmpty()
        .withMessage('내용은 필수입니다.')
        .isLength({ min: 10 })
        .withMessage('내용은 최소 10자 이상이어야 합니다.'),
      
      body('url')
        .notEmpty()
        .withMessage('URL은 필수입니다.')
        .isURL()
        .withMessage('유효한 URL을 입력해주세요.'),
      
      body('source')
        .notEmpty()
        .withMessage('뉴스 소스는 필수입니다.')
        .isLength({ min: 1, max: 100 })
        .withMessage('뉴스 소스는 1-100자 사이여야 합니다.')
    ];
  }

  static updateNews(): ValidationChain[] {
    return [
      param('id')
        .notEmpty()
        .withMessage('뉴스 ID는 필수입니다.')
        .isString()
        .withMessage('유효한 뉴스 ID를 입력해주세요.'),
      
      body('title')
        .optional()
        .isLength({ min: 1, max: 500 })
        .withMessage('제목은 1-500자 사이여야 합니다.'),
      
      body('content')
        .optional()
        .isLength({ min: 10 })
        .withMessage('내용은 최소 10자 이상이어야 합니다.')
    ];
  }

  static createNewsCollection(): ValidationChain[] {
    return [
      body('name')
        .notEmpty()
        .withMessage('컬렉션 이름은 필수입니다.')
        .isLength({ min: 1, max: 100 })
        .withMessage('컬렉션 이름은 1-100자 사이여야 합니다.'),
      
      body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('설명은 최대 500자까지 가능합니다.')
    ];
  }

  static updateNewsCollection(): ValidationChain[] {
    return [
      param('id')
        .notEmpty()
        .withMessage('컬렉션 ID는 필수입니다.')
        .isString()
        .withMessage('유효한 컬렉션 ID를 입력해주세요.'),
      
      body('name')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('컬렉션 이름은 1-100자 사이여야 합니다.')
    ];
  }
}

/**
 * 번역 관련 검증
 */
export class TranslationValidation {
  // 텍스트 번역 검증
  static translateText(): ValidationChain[] {
    return [
      body('text')
        .notEmpty()
        .withMessage('번역할 텍스트는 필수입니다.')
        .isLength({ min: 1, max: 5000 })
        .withMessage('텍스트는 1-5000자 사이여야 합니다.'),
      
      body('targetLang')
        .notEmpty()
        .withMessage('대상 언어는 필수입니다.')
        .isLength({ min: 2, max: 5 })
        .withMessage('언어 코드는 2-5자 사이여야 합니다.'),
      
      body('sourceLang')
        .optional()
        .isLength({ min: 2, max: 5 })
        .withMessage('소스 언어 코드는 2-5자 사이여야 합니다.')
    ];
  }

  // 배치 번역 검증
  static translateBatch(): ValidationChain[] {
    return [
      body('texts')
        .isArray({ min: 1, max: 50 })
        .withMessage('텍스트 배열은 1-50개 사이여야 합니다.'),
      
      body('texts.*')
        .isLength({ min: 1, max: 1000 })
        .withMessage('각 텍스트는 1-1000자 사이여야 합니다.'),
      
      body('targetLang')
        .notEmpty()
        .withMessage('대상 언어는 필수입니다.')
        .isLength({ min: 2, max: 5 })
        .withMessage('언어 코드는 2-5자 사이여야 합니다.')
    ];
  }

  static updatePreferences(): ValidationChain[] {
    return [
      body('defaultTargetLang')
        .optional()
        .isLength({ min: 2, max: 5 })
        .withMessage('기본 대상 언어 코드는 2-5자 사이여야 합니다.'),
      
      body('defaultSourceLang')
        .optional()
        .isLength({ min: 2, max: 5 })
        .withMessage('기본 소스 언어 코드는 2-5자 사이여야 합니다.'),
      
      body('autoDetectSource')
        .optional()
        .isBoolean()
        .withMessage('자동 소스 언어 감지는 boolean 값이어야 합니다.')
    ];
  }

  static cleanupCache(): ValidationChain[] {
    return [
      query('days')
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage('일수는 1-365 사이의 정수여야 합니다.')
    ];
  }
}

/**
 * 사용자 관련 검증
 */
export class UserValidation {
  // 사용자 생성 (회원가입) 검증
  static createUser(): ValidationChain[] {
    return [
      body('email')
        .isEmail()
        .withMessage('유효한 이메일 주소를 입력해주세요.')
        .normalizeEmail(),
      body('password')
        .isLength({ min: 8 })
        .withMessage('비밀번호는 최소 8자 이상이어야 합니다.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('비밀번호는 대소문자와 숫자를 포함해야 합니다.'),
      body('name')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('이름은 2-50자 사이여야 합니다.')
        .trim()
    ];
  }

  // 로그인 검증
  static login(): ValidationChain[] {
    return [
      body('email')
        .isEmail()
        .withMessage('유효한 이메일 주소를 입력해주세요.')
        .normalizeEmail(),
      body('password')
        .notEmpty()
        .withMessage('비밀번호를 입력해주세요.')
    ];
  }

  // 사용자 언어 설정 검증
  static updateLanguage(): ValidationChain[] {
    return [
      body('language')
        .notEmpty()
        .withMessage('언어 설정은 필수입니다.')
        .isIn(['ko', 'en', 'ja'])
        .withMessage('지원하지 않는 언어입니다.')
    ];
  }

  // 키워드 추가 검증
  static addKeyword(): ValidationChain[] {
    return [
      body('keyword')
        .notEmpty()
        .withMessage('키워드는 필수입니다.')
        .isLength({ min: 1, max: 50 })
        .withMessage('키워드는 1-50자 사이여야 합니다.')
        .trim()
        .toLowerCase(),
      body('category')
        .optional()
        .isLength({ min: 1, max: 30 })
        .withMessage('카테고리는 1-30자 사이여야 합니다.')
        .trim()
    ];
  }

  // 키워드 삭제 검증
  static deleteKeyword(): ValidationChain[] {
    return ValidationRules.id();
  }
}

/**
 * 카카오 챗봇 관련 검증
 */
export class KakaoValidation {
  // 챗봇 콜백 검증
  static chatbotCallback(): ValidationChain[] {
    return [
      body('userRequest')
        .notEmpty()
        .withMessage('사용자 요청 정보는 필수입니다.')
        .isObject()
        .withMessage('사용자 요청 정보는 객체여야 합니다.'),
      body('userRequest.user.id')
        .notEmpty()
        .withMessage('사용자 ID는 필수입니다.')
        .isString()
        .withMessage('사용자 ID는 문자열이어야 합니다.'),
      body('userRequest.utterance')
        .notEmpty()
        .withMessage('사용자 발화는 필수입니다.')
        .isString()
        .withMessage('사용자 발화는 문자열이어야 합니다.')
        .isLength({ min: 1, max: 1000 })
        .withMessage('사용자 발화는 1-1000자 사이여야 합니다.')
    ];
  }
}

/**
 * 검증 미들웨어 생성 헬퍼
 */
export const createValidationMiddleware = (validations: ValidationChain[]) => {
  return [...validations, handleValidationErrors];
};

// 자주 사용되는 검증 미들웨어 미리 생성
export const validatePagination = createValidationMiddleware(ValidationRules.pagination());
export const validateId = createValidationMiddleware(ValidationRules.id());
export const validateNewsSearch = createValidationMiddleware(NewsValidation.searchNews());
export const validateTranslateText = createValidationMiddleware(TranslationValidation.translateText());
export const validateTranslateBatch = createValidationMiddleware(TranslationValidation.translateBatch());

// 에러 처리 개선
const formatValidationError = (error: any): string => {
  if (error.msg) {
    return error.msg;
  }
  if (error.message) {
    return error.message;
  }
  return '유효성 검증 오류가 발생했습니다.';
};

const formatValidationErrors = (errors: any[]): string => {
  if (errors.length === 0) {
    return '유효성 검증 오류가 발생했습니다.';
  }
  
  const firstError = errors[0];
  const field = firstError.path || firstError.location || 'field';
  const message = formatValidationError(firstError);
  
  return `${field}: ${message}`;
};
