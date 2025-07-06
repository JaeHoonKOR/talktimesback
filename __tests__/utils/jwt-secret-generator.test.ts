import fs from 'fs';
import path from 'path';
import {
    ensureAllSecrets,
    ensureJWTSecret,
    ensureNextAuthSecret,
    generateJWTSecret
} from '../../src/utils/jwt-secret-generator';
import { mockEnvironmentVariable } from '../helpers/test-utils';

// fs 모듈 모킹
jest.mock('fs');
jest.mock('path');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;

describe('JWT Secret Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 기본 환경 변수 초기화
    delete process.env.JWT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
  });

  describe('generateJWTSecret', () => {
    it('기본 64자 길이의 시크릿을 생성해야 함', () => {
      const secret = generateJWTSecret();
      
      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBe(128); // 64 바이트 = 128 헥사 문자
      expect(/^[a-f0-9]+$/i.test(secret)).toBe(true); // 헥사 문자만 포함
    });

    it('지정된 길이의 시크릿을 생성해야 함', () => {
      const secret32 = generateJWTSecret(32);
      const secret128 = generateJWTSecret(128);
      
      expect(secret32.length).toBe(64); // 32 바이트 = 64 헥사 문자
      expect(secret128.length).toBe(256); // 128 바이트 = 256 헥사 문자
    });

    it('매번 다른 시크릿을 생성해야 함', () => {
      const secret1 = generateJWTSecret();
      const secret2 = generateJWTSecret();
      
      expect(secret1).not.toBe(secret2);
    });
  });

  describe('ensureJWTSecret', () => {
    beforeEach(() => {
      // path.join 모킹
      mockedPath.join.mockImplementation((...args) => args.join('/'));
      
      // process.cwd 모킹
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
    });

    it('환경 변수에 JWT_SECRET이 있으면 그대로 사용해야 함', () => {
      const existingSecret = 'existing-jwt-secret-key-32-chars-long-abcdefghijklmnopqr';
      process.env.JWT_SECRET = existingSecret;
      
      const result = ensureJWTSecret();
      
      expect(result).toBe(existingSecret);
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('JWT_SECRET이 없으면 새로 생성해야 함', () => {
      // .env 파일이 존재하지 않는 경우
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.writeFileSync.mockImplementation(() => {});
      
      const result = ensureJWTSecret();
      
      expect(result).toBeDefined();
      expect(result.length).toBe(128); // 64 바이트 = 128 헥사 문자
      expect(process.env.JWT_SECRET).toBe(result);
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });

    it('약한 JWT_SECRET이 있으면 교체해야 함', () => {
      const weakSecrets = [
        'weak',
        'your-secret-key',
        'default-secret',
        'short'
      ];

      weakSecrets.forEach((weakSecret) => {
        // 테스트 초기화
        jest.clearAllMocks();
        delete process.env.JWT_SECRET;
        
        process.env.JWT_SECRET = weakSecret;
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.writeFileSync.mockImplementation(() => {});
        
        const result = ensureJWTSecret();
        
        expect(result).not.toBe(weakSecret);
        expect(result.length).toBe(128);
        expect(mockedFs.writeFileSync).toHaveBeenCalled();
      });
    });

    it('.env 파일에서 JWT_SECRET을 읽어야 함', () => {
      const envContent = `
DATABASE_URL=test
JWT_SECRET="file-based-secret-key-32-chars-long-abcdefghijklmnopqr"
OTHER_VAR=value
      `.trim();
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(envContent);
      
      const result = ensureJWTSecret();
      
      expect(result).toBe('file-based-secret-key-32-chars-long-abcdefghijklmnopqr');
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('파일 쓰기 실패 시 에러를 던져야 함', () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('File write failed');
      });
      
      expect(() => ensureJWTSecret()).toThrow('JWT_SECRET 자동 생성에 실패했습니다.');
    });
  });

  describe('ensureNextAuthSecret', () => {
    beforeEach(() => {
      mockedPath.join.mockImplementation((...args) => args.join('/'));
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
    });

    it('NEXTAUTH_SECRET이 없으면 새로 생성해야 함', () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.writeFileSync.mockImplementation(() => {});
      
      const result = ensureNextAuthSecret();
      
      expect(result).toBeDefined();
      expect(result.length).toBe(128);
      expect(process.env.NEXTAUTH_SECRET).toBe(result);
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });

    it('기존 NEXTAUTH_SECRET이 유효하면 그대로 사용해야 함', () => {
      const existingSecret = 'existing-nextauth-secret-key-32-chars-long-abcdefghijklmnopqr';
      process.env.NEXTAUTH_SECRET = existingSecret;
      
      const result = ensureNextAuthSecret();
      
      expect(result).toBe(existingSecret);
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('ensureAllSecrets', () => {
    beforeEach(() => {
      mockedPath.join.mockImplementation((...args) => args.join('/'));
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.writeFileSync.mockImplementation(() => {});
    });

    it('모든 시크릿을 생성하고 반환해야 함', () => {
      const result = ensureAllSecrets();
      
      expect(result).toHaveProperty('jwtSecret');
      expect(result).toHaveProperty('nextAuthSecret');
      expect(result.jwtSecret.length).toBe(128);
      expect(result.nextAuthSecret.length).toBe(128);
      expect(process.env.JWT_SECRET).toBe(result.jwtSecret);
      expect(process.env.NEXTAUTH_SECRET).toBe(result.nextAuthSecret);
    });

    it('시크릿 생성 실패 시 에러를 던져야 함', () => {
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });
      
      expect(() => ensureAllSecrets()).toThrow();
    });
  });

  describe('환경 변수 복원', () => {
    it('테스트 후 환경 변수가 정리되어야 함', () => {
      const restoreJWT = mockEnvironmentVariable('JWT_SECRET', 'temp-value');
      const restoreNextAuth = mockEnvironmentVariable('NEXTAUTH_SECRET', 'temp-value');
      
      expect(process.env.JWT_SECRET).toBe('temp-value');
      expect(process.env.NEXTAUTH_SECRET).toBe('temp-value');
      
      restoreJWT();
      restoreNextAuth();
      
      expect(process.env.JWT_SECRET).toBeUndefined();
      expect(process.env.NEXTAUTH_SECRET).toBeUndefined();
    });
  });
}); 