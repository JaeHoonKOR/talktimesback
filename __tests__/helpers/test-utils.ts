import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

/**
 * 테스트용 JWT 토큰 생성
 */
export function createTestJWTToken(payload: any = {}, expiresIn: string = '1h'): string {
  const defaultPayload = {
    userId: 'test-user-id',
    email: 'test@example.com',
    role: 'user',
    ...payload
  };
  
  return jwt.sign(defaultPayload, process.env.JWT_SECRET!, { expiresIn });
}

/**
 * 만료된 JWT 토큰 생성
 */
export function createExpiredJWTToken(payload: any = {}): string {
  return createTestJWTToken(payload, '-1h'); // 1시간 전에 만료
}

/**
 * 잘못된 JWT 토큰 생성
 */
export function createInvalidJWTToken(): string {
  return 'invalid.jwt.token';
}

/**
 * 테스트용 Express Request 객체 생성
 */
export function createMockRequest(options: {
  method?: string;
  path?: string;
  body?: any;
  query?: any;
  params?: any;
  headers?: any;
  user?: any;
} = {}): Partial<Request> {
  return {
    method: options.method || 'GET',
    path: options.path || '/test',
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    headers: options.headers || {},
    user: options.user || undefined,
    get: jest.fn((header: string) => options.headers?.[header.toLowerCase()]),
    ip: '127.0.0.1',
    protocol: 'http',
    secure: false,
    originalUrl: options.path || '/test'
  };
}

/**
 * 테스트용 Express Response 객체 생성
 */
export function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  };
  
  return res;
}

/**
 * 테스트용 Next 함수 생성
 */
export function createMockNext(): jest.Mock {
  return jest.fn();
}

/**
 * 테스트 데이터 생성기
 */
export const TestDataFactory = {
  /**
   * 테스트용 뉴스 데이터 생성
   */
  createNewsData(overrides: any = {}) {
    return {
      id: 'test-news-id',
      title: 'Test News Title',
      content: 'Test news content',
      url: 'https://test.com/news',
      publishedAt: new Date().toISOString(),
      source: 'test-source',
      category: 'technology',
      summary: 'Test summary',
      isPersonalized: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  },

  /**
   * 테스트용 사용자 데이터 생성
   */
  createUserData(overrides: any = {}) {
    return {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  },

  /**
   * 테스트용 번역 데이터 생성
   */
  createTranslationData(overrides: any = {}) {
    return {
      id: 'test-translation-id',
      sourceText: 'Hello, world!',
      translatedText: '안녕, 세계!',
      sourceLang: 'en',
      targetLang: 'ko',
      userId: 'test-user-id',
      createdAt: new Date().toISOString(),
      ...overrides
    };
  }
};

/**
 * 비동기 함수 테스트 헬퍼
 */
export async function expectAsyncError(
  asyncFn: () => Promise<any>,
  expectedError?: string | RegExp
): Promise<void> {
  try {
    await asyncFn();
    fail('Expected function to throw an error');
  } catch (error: any) {
    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(error.message).toContain(expectedError);
      } else {
        expect(error.message).toMatch(expectedError);
      }
    }
  }
}

/**
 * 시간 모킹 헬퍼
 */
export function mockDateNow(fixedTime: string | number | Date) {
  const mockDate = new Date(fixedTime);
  jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
}

/**
 * 환경 변수 모킹 헬퍼
 */
export function mockEnvironmentVariable(key: string, value: string) {
  const originalValue = process.env[key];
  process.env[key] = value;
  
  return () => {
    if (originalValue !== undefined) {
      process.env[key] = originalValue;
    } else {
      delete process.env[key];
    }
  };
}

/**
 * 테스트 데이터 검증 헬퍼
 */
export const TestValidators = {
  /**
   * API 응답 형식 검증
   */
  validateApiResponse(response: any, expectedStatus: number = 200) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toBeDefined();
    
    if (expectedStatus >= 200 && expectedStatus < 300) {
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    } else {
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    }
  },

  /**
   * 에러 응답 형식 검증
   */
  validateErrorResponse(response: any, expectedStatus: number, expectedMessage?: string) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    
    if (expectedMessage) {
      expect(response.body.error.message).toContain(expectedMessage);
    }
  },

  /**
   * 페이지네이션 응답 검증
   */
  validatePaginationResponse(response: any) {
    this.validateApiResponse(response);
    expect(response.body.pagination).toBeDefined();
    expect(response.body.pagination.page).toBeGreaterThan(0);
    expect(response.body.pagination.limit).toBeGreaterThan(0);
    expect(response.body.pagination.total).toBeGreaterThanOrEqual(0);
  }
}; 