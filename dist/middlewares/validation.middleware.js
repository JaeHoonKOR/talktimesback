"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTranslateBatch = exports.validateTranslateText = exports.validateNewsSearch = exports.validateId = exports.validatePagination = exports.createValidationMiddleware = exports.KakaoValidation = exports.UserValidation = exports.TranslationValidation = exports.NewsValidation = exports.ValidationRules = exports.handleValidationErrors = void 0;
const express_validator_1 = require("express-validator");
const response_helper_1 = require("../utils/response.helper");
/**
 * 검증 결과를 처리하는 미들웨어
 */
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const firstError = errors.array()[0];
        response_helper_1.ResponseHelper.validationError(res, firstError.msg, firstError.param, errors.array());
        return;
    }
    next();
};
exports.handleValidationErrors = handleValidationErrors;
/**
 * 공통 검증 규칙
 */
class ValidationRules {
    // ID 검증
    static id(paramName = 'id') {
        return [(0, express_validator_1.param)(paramName)
                .notEmpty()
                .withMessage(`${paramName}은 필수입니다.`)
                .isString()
                .withMessage(`유효한 ${paramName}을 입력해주세요.`)];
    }
    // 페이지네이션 검증
    static pagination() {
        return [
            (0, express_validator_1.query)('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('페이지는 1 이상의 정수여야 합니다.'),
            (0, express_validator_1.query)('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('한 페이지당 항목 수는 1-100 사이여야 합니다.')
        ];
    }
    // 정렬 검증
    static sorting(allowedFields) {
        return [
            (0, express_validator_1.query)('sortBy')
                .optional()
                .isIn(allowedFields)
                .withMessage(`정렬 필드는 다음 중 하나여야 합니다: ${allowedFields.join(', ')}`),
            (0, express_validator_1.query)('sortOrder')
                .optional()
                .isIn(['asc', 'desc'])
                .withMessage('정렬 순서는 asc 또는 desc여야 합니다.')
        ];
    }
    // 날짜 범위 검증
    static dateRange() {
        return [
            (0, express_validator_1.query)('startDate')
                .optional()
                .isISO8601()
                .withMessage('시작 날짜는 유효한 ISO8601 형식이어야 합니다.'),
            (0, express_validator_1.query)('endDate')
                .optional()
                .isISO8601()
                .withMessage('종료 날짜는 유효한 ISO8601 형식이어야 합니다.')
        ];
    }
    // 검색 검증
    static search() {
        return [
            (0, express_validator_1.query)('search')
                .optional()
                .isLength({ min: 1, max: 100 })
                .withMessage('검색어는 1-100자 사이여야 합니다.')
                .trim()
        ];
    }
    // 언어 코드 검증
    static languageCode() {
        return (0, express_validator_1.param)('lang')
            .notEmpty()
            .withMessage('언어 코드는 필수입니다.')
            .isLength({ min: 2, max: 5 })
            .withMessage('언어 코드는 2-5자 사이여야 합니다.');
    }
    // 카테고리 검증
    static category() {
        return (0, express_validator_1.query)('category')
            .optional()
            .isIn(['politics', 'economy', 'society', 'culture', 'world', 'sports', 'entertainment', 'tech'])
            .withMessage('유효한 카테고리가 아닙니다.');
    }
    // 텍스트 길이 검증
    static textLength(maxLength = 1000) {
        return (0, express_validator_1.body)('text')
            .notEmpty()
            .withMessage('텍스트는 필수입니다.')
            .isLength({ min: 1, max: maxLength })
            .withMessage(`텍스트는 1-${maxLength}자 사이여야 합니다.`);
    }
}
exports.ValidationRules = ValidationRules;
/**
 * 뉴스 관련 검증
 */
class NewsValidation {
    // 뉴스 목록 조회 검증
    static getNewsList() {
        return [
            ...ValidationRules.pagination(),
            ...ValidationRules.sorting(['createdAt', 'publishedAt', 'title']),
            ...ValidationRules.dateRange(),
            ...ValidationRules.search(),
            ValidationRules.category(),
            (0, express_validator_1.query)('sources')
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
    static searchNews() {
        return [
            (0, express_validator_1.query)('keywords')
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
    static getNewsById() {
        return [ValidationRules.id()];
    }
    // 카테고리별 뉴스 검증
    static getNewsByCategory() {
        return [
            (0, express_validator_1.param)('category')
                .notEmpty()
                .withMessage('카테고리는 필수입니다.')
                .isIn(['politics', 'economy', 'society', 'culture', 'world', 'sports', 'entertainment', 'tech'])
                .withMessage('유효한 카테고리가 아닙니다.'),
            ...ValidationRules.pagination()
        ];
    }
    static createNews() {
        return [
            (0, express_validator_1.body)('title')
                .notEmpty()
                .withMessage('제목은 필수입니다.')
                .isLength({ min: 1, max: 500 })
                .withMessage('제목은 1-500자 사이여야 합니다.'),
            (0, express_validator_1.body)('content')
                .notEmpty()
                .withMessage('내용은 필수입니다.')
                .isLength({ min: 10 })
                .withMessage('내용은 최소 10자 이상이어야 합니다.'),
            (0, express_validator_1.body)('url')
                .notEmpty()
                .withMessage('URL은 필수입니다.')
                .isURL()
                .withMessage('유효한 URL을 입력해주세요.'),
            (0, express_validator_1.body)('source')
                .notEmpty()
                .withMessage('뉴스 소스는 필수입니다.')
                .isLength({ min: 1, max: 100 })
                .withMessage('뉴스 소스는 1-100자 사이여야 합니다.')
        ];
    }
    static updateNews() {
        return [
            (0, express_validator_1.param)('id')
                .notEmpty()
                .withMessage('뉴스 ID는 필수입니다.')
                .isString()
                .withMessage('유효한 뉴스 ID를 입력해주세요.'),
            (0, express_validator_1.body)('title')
                .optional()
                .isLength({ min: 1, max: 500 })
                .withMessage('제목은 1-500자 사이여야 합니다.'),
            (0, express_validator_1.body)('content')
                .optional()
                .isLength({ min: 10 })
                .withMessage('내용은 최소 10자 이상이어야 합니다.')
        ];
    }
    static createNewsCollection() {
        return [
            (0, express_validator_1.body)('name')
                .notEmpty()
                .withMessage('컬렉션 이름은 필수입니다.')
                .isLength({ min: 1, max: 100 })
                .withMessage('컬렉션 이름은 1-100자 사이여야 합니다.'),
            (0, express_validator_1.body)('description')
                .optional()
                .isLength({ max: 500 })
                .withMessage('설명은 최대 500자까지 가능합니다.')
        ];
    }
    static updateNewsCollection() {
        return [
            (0, express_validator_1.param)('id')
                .notEmpty()
                .withMessage('컬렉션 ID는 필수입니다.')
                .isString()
                .withMessage('유효한 컬렉션 ID를 입력해주세요.'),
            (0, express_validator_1.body)('name')
                .optional()
                .isLength({ min: 1, max: 100 })
                .withMessage('컬렉션 이름은 1-100자 사이여야 합니다.')
        ];
    }
}
exports.NewsValidation = NewsValidation;
/**
 * 번역 관련 검증
 */
class TranslationValidation {
    // 텍스트 번역 검증
    static translateText() {
        return [
            (0, express_validator_1.body)('text')
                .notEmpty()
                .withMessage('번역할 텍스트는 필수입니다.')
                .isLength({ min: 1, max: 5000 })
                .withMessage('텍스트는 1-5000자 사이여야 합니다.'),
            (0, express_validator_1.body)('targetLang')
                .notEmpty()
                .withMessage('대상 언어는 필수입니다.')
                .isLength({ min: 2, max: 5 })
                .withMessage('언어 코드는 2-5자 사이여야 합니다.'),
            (0, express_validator_1.body)('sourceLang')
                .optional()
                .isLength({ min: 2, max: 5 })
                .withMessage('소스 언어 코드는 2-5자 사이여야 합니다.')
        ];
    }
    // 배치 번역 검증
    static translateBatch() {
        return [
            (0, express_validator_1.body)('texts')
                .isArray({ min: 1, max: 50 })
                .withMessage('텍스트 배열은 1-50개 사이여야 합니다.'),
            (0, express_validator_1.body)('texts.*')
                .isLength({ min: 1, max: 1000 })
                .withMessage('각 텍스트는 1-1000자 사이여야 합니다.'),
            (0, express_validator_1.body)('targetLang')
                .notEmpty()
                .withMessage('대상 언어는 필수입니다.')
                .isLength({ min: 2, max: 5 })
                .withMessage('언어 코드는 2-5자 사이여야 합니다.')
        ];
    }
    static updatePreferences() {
        return [
            (0, express_validator_1.body)('defaultTargetLang')
                .optional()
                .isLength({ min: 2, max: 5 })
                .withMessage('기본 대상 언어 코드는 2-5자 사이여야 합니다.'),
            (0, express_validator_1.body)('defaultSourceLang')
                .optional()
                .isLength({ min: 2, max: 5 })
                .withMessage('기본 소스 언어 코드는 2-5자 사이여야 합니다.'),
            (0, express_validator_1.body)('autoDetectSource')
                .optional()
                .isBoolean()
                .withMessage('자동 소스 언어 감지는 boolean 값이어야 합니다.')
        ];
    }
    static cleanupCache() {
        return [
            (0, express_validator_1.query)('days')
                .optional()
                .isInt({ min: 1, max: 365 })
                .withMessage('일수는 1-365 사이의 정수여야 합니다.')
        ];
    }
}
exports.TranslationValidation = TranslationValidation;
/**
 * 사용자 관련 검증
 */
class UserValidation {
    // 사용자 생성 (회원가입) 검증
    static createUser() {
        return [
            (0, express_validator_1.body)('email')
                .isEmail()
                .withMessage('유효한 이메일 주소를 입력해주세요.')
                .normalizeEmail(),
            (0, express_validator_1.body)('password')
                .isLength({ min: 8 })
                .withMessage('비밀번호는 최소 8자 이상이어야 합니다.')
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
                .withMessage('비밀번호는 대소문자와 숫자를 포함해야 합니다.'),
            (0, express_validator_1.body)('name')
                .optional()
                .isLength({ min: 2, max: 50 })
                .withMessage('이름은 2-50자 사이여야 합니다.')
                .trim()
        ];
    }
    // 로그인 검증
    static login() {
        return [
            (0, express_validator_1.body)('email')
                .isEmail()
                .withMessage('유효한 이메일 주소를 입력해주세요.')
                .normalizeEmail(),
            (0, express_validator_1.body)('password')
                .notEmpty()
                .withMessage('비밀번호를 입력해주세요.')
        ];
    }
    // 사용자 언어 설정 검증
    static updateLanguage() {
        return [
            (0, express_validator_1.body)('language')
                .notEmpty()
                .withMessage('언어 설정은 필수입니다.')
                .isIn(['ko', 'en', 'ja'])
                .withMessage('지원하지 않는 언어입니다.')
        ];
    }
    // 키워드 추가 검증
    static addKeyword() {
        return [
            (0, express_validator_1.body)('keyword')
                .notEmpty()
                .withMessage('키워드는 필수입니다.')
                .isLength({ min: 1, max: 50 })
                .withMessage('키워드는 1-50자 사이여야 합니다.')
                .trim()
                .toLowerCase(),
            (0, express_validator_1.body)('category')
                .optional()
                .isLength({ min: 1, max: 30 })
                .withMessage('카테고리는 1-30자 사이여야 합니다.')
                .trim()
        ];
    }
    // 키워드 삭제 검증
    static deleteKeyword() {
        return [
            ValidationRules.id()
        ];
    }
}
exports.UserValidation = UserValidation;
/**
 * 카카오 챗봇 관련 검증
 */
class KakaoValidation {
    // 챗봇 콜백 검증
    static chatbotCallback() {
        return [
            (0, express_validator_1.body)('userRequest')
                .notEmpty()
                .withMessage('사용자 요청 정보는 필수입니다.')
                .isObject()
                .withMessage('사용자 요청 정보는 객체여야 합니다.'),
            (0, express_validator_1.body)('userRequest.user.id')
                .notEmpty()
                .withMessage('사용자 ID는 필수입니다.')
                .isString()
                .withMessage('사용자 ID는 문자열이어야 합니다.'),
            (0, express_validator_1.body)('userRequest.utterance')
                .notEmpty()
                .withMessage('사용자 발화는 필수입니다.')
                .isString()
                .withMessage('사용자 발화는 문자열이어야 합니다.')
                .isLength({ min: 1, max: 1000 })
                .withMessage('사용자 발화는 1-1000자 사이여야 합니다.')
        ];
    }
}
exports.KakaoValidation = KakaoValidation;
/**
 * 검증 미들웨어 생성 헬퍼
 */
const createValidationMiddleware = (validations) => {
    return [...validations, exports.handleValidationErrors];
};
exports.createValidationMiddleware = createValidationMiddleware;
// 자주 사용되는 검증 미들웨어 미리 생성
exports.validatePagination = (0, exports.createValidationMiddleware)(ValidationRules.pagination());
exports.validateId = (0, exports.createValidationMiddleware)([ValidationRules.id()]);
exports.validateNewsSearch = (0, exports.createValidationMiddleware)(NewsValidation.searchNews());
exports.validateTranslateText = (0, exports.createValidationMiddleware)(TranslationValidation.translateText());
exports.validateTranslateBatch = (0, exports.createValidationMiddleware)(TranslationValidation.translateBatch());
// 에러 처리 개선
const formatValidationError = (error) => {
    if (error.msg) {
        return error.msg;
    }
    if (error.message) {
        return error.message;
    }
    return '유효성 검증 오류가 발생했습니다.';
};
const formatValidationErrors = (errors) => {
    if (errors.length === 0) {
        return '유효성 검증 오류가 발생했습니다.';
    }
    const firstError = errors[0];
    const field = firstError.path || firstError.location || 'field';
    const message = formatValidationError(firstError);
    return `${field}: ${message}`;
};
