import dotenv from 'dotenv';
import path from 'path';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';

// Jest 전역 타입 설정
/// <reference types="jest" />

// 테스트 환경 변수 설정
dotenv.config({
  path: path.join(__dirname, '..', '.env.test')
});

// 기본 환경 변수 설정 (테스트용)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-32-characters-long-abcdefghijklmnopqrstuvwxyz';
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-key-for-testing-only-32-characters-long-abcdefghijklmnopqrstuvwxyz';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/jiksend_test';
process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-translate-api-key';
process.env.OPENAI_API_KEY = 'test-openai-api-key';

// 콘솔 출력 제한 (테스트 중 로그 노이즈 방지)
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// 테스트 시작 전 실행
beforeAll(async () => {
  // 필요한 경우 콘솔 출력 비활성화
  if (process.env.JEST_SILENT === 'true') {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  }

  // 테스트 데이터베이스 설정
  await setupTestDatabase();
});

// 테스트 종료 후 실행
afterAll(async () => {
  // 콘솔 출력 복원
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;

  // 테스트 데이터베이스 정리
  await teardownTestDatabase();
});

// 각 테스트 케이스 실행 전
beforeEach(() => {
  // 모든 모킹 초기화
  jest.clearAllMocks();
});

// 각 테스트 케이스 실행 후
afterEach(() => {
  // 타이머 정리
  jest.useRealTimers();
});

// Jest 매처 확장
expect.extend({
  toBeValidDate(received: any) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid date`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid date`,
        pass: false,
      };
    }
  },
  
  toBeValidUUID(received: any) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  }
});

// Jest 매처 타입 확장
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidUUID(): R;
    }
  }
} 