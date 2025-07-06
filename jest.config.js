process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/jiksend_test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-32-characters-long';
process.env.JWT_ACCESS_EXPIRATION = '15m';
process.env.JWT_REFRESH_EXPIRATION = '7d';
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-key-for-testing-only-32-characters';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.JEST_SILENT = 'false';
process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-translate-api-key';
process.env.OPENAI_API_KEY = 'test-openai-api-key';
process.env.DB_CONNECTION_LIMIT = '10';
process.env.DB_QUERY_TIMEOUT = '30000';
process.env.DB_TRANSACTION_TIMEOUT = '60000';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'test-smtp-password';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        types: ['jest', 'node']
      }
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/app.ts',
    '!src/scripts/**',
    '!src/types/**',
    '!src/config/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  globalSetup: '<rootDir>/__tests__/globalSetup.ts',
  globalTeardown: '<rootDir>/__tests__/globalTeardown.ts'
}; 