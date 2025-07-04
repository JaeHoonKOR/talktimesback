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
      firstError.param,
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
  // 페이지네이션 검증
  static pagination(): ValidationChain[] {
    return [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('페이지는 1 이상의 정수여야 합니다.')
        .toInt(),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('제한은 1-100 사이의 정수여야 합니다.')
        .toInt()
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
        .withMessage('시작 날짜는 ISO8601 형식이어야 합니다.')
        .toDate(),
      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('종료 날짜는 ISO8601 형식이어야 합니다.')
        .toDate()
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

  // ID 검증
  static id(paramName: string = 'id'): ValidationChain {
    return param(paramName)
      .notEmpty()
      .withMessage(`${paramName}는 필수입니다.`)
      .custom((value) => {
        // UUID 또는 숫자 ID 검증
        if (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          return true;
        }
        if (typeof value === 'string' && value.match(/^\d+$/)) {
          return true;
        }
        throw new Error('유효한 ID 형식이 아닙니다.');
      });
  }

  // 언어 코드 검증
  static languageCode(): ValidationChain {
    return body('targetLang')
      .notEmpty()
      .withMessage('대상 언어는 필수입니다.')
      .isIn(['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'ru'])
      .withMessage('지원하지 않는 언어입니다.');
  }

  // 카테고리 검증
  static category(): ValidationChain {
    return query('category')
      .optional()
      .isIn(['politics', 'economy', 'society', 'culture', 'world', 'sports', 'entertainment', 'tech'])
      .withMessage('유효한 카테고리가 아닙니다.');
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
    return [ValidationRules.id()];
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
        .withMessage('텍스트는 1-5000자 사이여야 합니다.')
        .trim(),
      ValidationRules.languageCode(),
      body('sourceLang')
        .optional()
        .isIn(['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'ru'])
        .withMessage('지원하지 않는 소스 언어입니다.')
    ];
  }

  // 배치 번역 검증
  static translateBatch(): ValidationChain[] {
    return [
      body('texts')
        .isArray({ min: 1, max: 50 })
        .withMessage('텍스트는 1-50개의 배열이어야 합니다.')
        .custom((texts) => {
          return texts.every((text: any) => 
            typeof text === 'string' && 
            text.trim().length > 0 && 
            text.length <= 5000
          );
        })
        .withMessage('모든 텍스트는 1-5000자의 유효한 문자열이어야 합니다.'),
      ValidationRules.languageCode(),
      body('sourceLang')
        .optional()
        .isIn(['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'ru'])
        .withMessage('지원하지 않는 소스 언어입니다.')
    ];
  }

  // 뉴스 번역 검증
  static translateNews(): ValidationChain[] {
    return [
      ValidationRules.id(),
      query('lang')
        .optional()
        .isIn(['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'ru'])
        .withMessage('지원하지 않는 언어입니다.')
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
    return [
      ValidationRules.id()
    ];
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
export const validateId = createValidationMiddleware([ValidationRules.id()]);
export const validateNewsSearch = createValidationMiddleware(NewsValidation.searchNews());
export const validateTranslateText = createValidationMiddleware(TranslationValidation.translateText());
export const validateTranslateBatch = createValidationMiddleware(TranslationValidation.translateBatch());
