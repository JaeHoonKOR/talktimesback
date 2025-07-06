"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'JikSend API',
        version: '2.0.0',
        description: 'AI 기반 개인화 뉴스 서비스 API - v2 RESTful API 포함',
        contact: {
            name: 'JikSend Team',
            email: 'support@jiksend.com',
        },
    },
    servers: [
        {
            url: process.env.NODE_ENV === 'production'
                ? 'https://api.jiksend.com'
                : 'http://localhost:4000',
            description: process.env.NODE_ENV === 'production'
                ? 'Production server'
                : 'Development server',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT 토큰을 사용한 인증',
            },
        },
        schemas: {
            ApiResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    data: { description: '응답 데이터' },
                    error: { $ref: '#/components/schemas/ApiError' },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                    timestamp: { type: 'string', format: 'date-time' },
                },
                required: ['success', 'timestamp'],
            },
            ApiError: {
                type: 'object',
                properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    details: { description: '에러 상세 정보' },
                    field: { type: 'string' },
                },
                required: ['code', 'message'],
            },
            PaginationMeta: {
                type: 'object',
                properties: {
                    page: { type: 'integer', minimum: 1 },
                    limit: { type: 'integer', minimum: 1, maximum: 100 },
                    total: { type: 'integer', minimum: 0 },
                    totalPages: { type: 'integer', minimum: 0 },
                    hasNext: { type: 'boolean' },
                    hasPrev: { type: 'boolean' },
                },
                required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev'],
            },
            NewsItem: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    url: { type: 'string', format: 'uri' },
                    source: { type: 'string' },
                    sourceId: { type: 'string' },
                    category: {
                        type: 'string',
                        enum: ['politics', 'economy', 'society', 'culture', 'world', 'sports', 'entertainment', 'tech']
                    },
                    publishedAt: { type: 'string', format: 'date-time' },
                    excerpt: { type: 'string' },
                    content: { type: 'string' },
                    imageUrl: { type: 'string', format: 'uri' },
                    isProcessed: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
                required: ['id', 'title', 'url', 'source', 'sourceId', 'category', 'publishedAt', 'excerpt', 'isProcessed', 'createdAt', 'updatedAt'],
            },
            TranslationRequest: {
                type: 'object',
                properties: {
                    text: { type: 'string', minLength: 1, maxLength: 5000 },
                    targetLang: {
                        type: 'string',
                        enum: ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'ru']
                    },
                    sourceLang: {
                        type: 'string',
                        enum: ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'ru']
                    },
                },
                required: ['text', 'targetLang'],
            },
            TranslationResponse: {
                type: 'object',
                properties: {
                    originalText: { type: 'string' },
                    translatedText: { type: 'string' },
                    sourceLang: { type: 'string' },
                    targetLang: { type: 'string' },
                    cached: { type: 'boolean' },
                },
                required: ['originalText', 'translatedText', 'sourceLang', 'targetLang', 'cached'],
            },
        },
    },
    tags: [
        { name: 'Health', description: '헬스체크 관련 API' },
        { name: 'News', description: '뉴스 관련 API (v1 - Deprecated)' },
        { name: 'Translation', description: '번역 관련 API (v1 - Deprecated)' },
        { name: 'Auth', description: '인증 관련 API (v1 - Deprecated)' },
        { name: 'News v2', description: '뉴스 관련 API (v2 - RESTful)' },
        { name: 'Translation v2', description: '번역 관련 API (v2 - RESTful)' },
        { name: 'Users v2', description: '사용자 관련 API (v2 - RESTful)' },
    ],
};
const options = {
    definition: swaggerDefinition,
    apis: ['./src/routes/*.ts'],
};
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(options);
exports.default = exports.swaggerSpec;
