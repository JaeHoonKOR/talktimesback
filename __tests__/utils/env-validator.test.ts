import { maskSensitiveValue, validateEnvironmentVariables } from '../../src/utils/env-validator';

describe('Environment Validator', () => {
  describe('maskSensitiveValue', () => {
    it('민감한 키워드가 포함된 값을 마스킹해야 함', () => {
      const tests = [
        { key: 'JWT_SECRET', value: 'mysecretkey123', expected: 'my**********23' },
        { key: 'PASSWORD', value: 'pass123', expected: 'pa***23' },
        { key: 'API_KEY', value: 'key456789', expected: 'ke*****89' },
        { key: 'TOKEN', value: 'abc', expected: '***' }
      ];

      tests.forEach(({ key, value, expected }) => {
        const result = maskSensitiveValue(key, value);
        expect(result).toBe(expected);
      });
    });

    it('민감하지 않은 키의 값은 그대로 반환해야 함', () => {
      const result = maskSensitiveValue('DATABASE_URL', 'postgres://localhost:5432/db');
      expect(result).toBe('postgres://localhost:5432/db');
    });

    it('빈 값에 대해서도 처리해야 함', () => {
      const result = maskSensitiveValue('SECRET', '');
      expect(result).toBe('***');
    });
  });

  describe('validateEnvironmentVariables', () => {
    afterEach(() => {
      // 각 테스트 후 환경 변수 정리
      delete process.env.JWT_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.DATABASE_URL;
    });

    it('필수 환경 변수가 모두 있으면 정상 실행되어야 함', () => {
      // 필수 환경 변수 설정
      process.env.JWT_SECRET = 'test-jwt-secret-key-32-characters-long-abcdefghijklmnopqr';
      process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-key-32-characters-long-abcdefghijklmnopqr';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';

      // 에러 없이 실행되어야 함
      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('JWT_SECRET이 자동 생성되어야 함', () => {
      // JWT_SECRET 없이 시작
      delete process.env.JWT_SECRET;
      process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-key-32-characters-long-abcdefghijklmnopqr';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';

      // 자동 생성 기능으로 인해 에러 없이 실행되어야 함
      expect(() => validateEnvironmentVariables()).not.toThrow();
      
      // JWT_SECRET이 자동 생성되었는지 확인
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET!.length).toBeGreaterThan(32);
    });

    it('DATABASE_URL이 없으면 에러를 던져야 함', () => {
      process.env.JWT_SECRET = 'test-jwt-secret-key-32-characters-long-abcdefghijklmnopqr';
      process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-key-32-characters-long-abcdefghijklmnopqr';
      // DATABASE_URL 없음

      // process.exit(1)을 호출하므로 별도 처리 필요
      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      expect(() => validateEnvironmentVariables()).not.toThrow();
      expect(process.exit).toHaveBeenCalledWith(1);

      // 원래 process.exit 복원
      process.exit = originalExit;
    });
  });
}); 