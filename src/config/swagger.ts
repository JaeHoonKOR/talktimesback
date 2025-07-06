import swaggerJSDoc from 'swagger-jsdoc';

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
          type: { 
            type: 'string', 
            enum: [
              'SYSTEM', 'DATABASE', 'NETWORK', 'AUTHENTICATION', 'AUTHORIZATION',
              'VALIDATION', 'RATE_LIMIT', 'TRANSLATION', 'NEWS', 'USER',
              'EXTERNAL_API', 'GOOGLE_TRANSLATE', 'RSS_FEED', 'NOT_FOUND', 'UNKNOWN'
            ]
          },
          message: { type: 'string' },
          httpCode: { type: 'integer' },
          isRetryable: { type: 'boolean' },
          errorId: { type: 'string' },
          context: { type: 'object', description: '에러 컨텍스트 (개발 환경에서만 제공)' },
        },
        required: ['type', 'message', 'httpCode', 'isRetryable', 'errorId'],
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
      CursorPaginationMeta: {
        type: 'object',
        properties: {
          nextCursor: { type: 'string', nullable: true },
          hasNextPage: { type: 'boolean' },
          count: { type: 'integer', minimum: 0 },
        },
        required: ['hasNextPage', 'count'],
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
      NewsSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          category: { 
            type: 'string',
            enum: ['politics', 'economy', 'society', 'culture', 'world', 'sports', 'entertainment', 'tech']
          },
          keywords: { type: 'array', items: { type: 'string' } },
          originalNewsIds: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'title', 'summary', 'category', 'keywords', 'createdAt', 'updatedAt'],
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
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          provider: { type: 'string', enum: ['local', 'kakao', 'google'] },
          profileImage: { type: 'string', format: 'uri' },
          preferredTime: { type: 'string', format: 'time' },
          language: { type: 'string', enum: ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'ru'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'email', 'language', 'createdAt', 'updatedAt'],
      },
      Keyword: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer' },
          keyword: { type: 'string' },
          category: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'userId', 'keyword', 'createdAt', 'updatedAt'],
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'string' },
        },
        required: ['accessToken', 'refreshToken', 'expiresIn'],
      },
      SupabaseMCP: {
        type: 'object',
        description: 'Supabase Management Console Platform 정보',
        properties: {
          projectId: { type: 'string' },
          apiUrl: { type: 'string', format: 'uri' },
          dbUrl: { type: 'string' },
          adminPanel: { type: 'string', format: 'uri' },
          connectionString: { type: 'string' },
        },
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
    { name: 'Supabase', description: 'Supabase MCP 관련 정보' },
  ],
  externalDocs: {
    description: 'Supabase 문서',
    url: 'https://supabase.com/docs',
  },
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;
