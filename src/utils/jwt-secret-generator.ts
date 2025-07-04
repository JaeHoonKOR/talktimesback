import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { serverLogger } from './logger';

/**
 * 강력한 JWT 시크릿 키 생성
 * 
 * @param length 키 길이 (기본값: 64)
 * @returns 생성된 시크릿 키
 */
export function generateJWTSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * .env 파일 경로 찾기
 */
function findEnvFile(): string {
  const possiblePaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../../../.env')
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }

  // .env 파일이 없으면 프로젝트 루트에 생성
  return path.join(process.cwd(), '.env');
}

/**
 * .env 파일에서 특정 키의 값을 읽기
 */
function readEnvValue(envPath: string, key: string): string | null {
  try {
    if (!fs.existsSync(envPath)) {
      return null;
    }

    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith(`${key}=`)) {
        const value = trimmedLine.substring(key.length + 1);
        // 따옴표 제거
        return value.replace(/^["']|["']$/g, '');
      }
    }
    
    return null;
  } catch (error) {
    serverLogger.error('환경 변수 파일 읽기 실패', error as Error);
    return null;
  }
}

/**
 * .env 파일에 JWT_SECRET 추가 또는 업데이트
 */
function updateEnvFile(envPath: string, key: string, value: string): boolean {
  try {
    let content = '';
    let keyExists = false;

    // 기존 파일이 있으면 읽기
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      
      // 기존 키가 있는지 확인하고 업데이트
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith(`${key}=`)) {
          lines[i] = `${key}="${value}"`;
          keyExists = true;
          break;
        }
      }
      
      content = lines.join('\n');
    }

    // 키가 없으면 추가
    if (!keyExists) {
      if (content && !content.endsWith('\n')) {
        content += '\n';
      }
      content += `# Automatically generated JWT secret\n${key}="${value}"\n`;
    }

    // 파일에 쓰기
    fs.writeFileSync(envPath, content, 'utf8');
    return true;
  } catch (error) {
    serverLogger.error('환경 변수 파일 업데이트 실패', error as Error);
    return false;
  }
}

/**
 * JWT_SECRET 자동 생성 및 설정
 */
export function ensureJWTSecret(): string {
  const envPath = findEnvFile();
  
  // 현재 환경 변수에서 JWT_SECRET 확인
  let jwtSecret = process.env.JWT_SECRET;
  
  // 환경 변수에 없으면 .env 파일에서 확인
  if (!jwtSecret) {
    jwtSecret = readEnvValue(envPath, 'JWT_SECRET');
  }

  // JWT_SECRET이 없거나 안전하지 않으면 새로 생성
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.includes('your-') || jwtSecret.includes('default')) {
    const newSecret = generateJWTSecret(64);
    
    // .env 파일에 저장
    const updated = updateEnvFile(envPath, 'JWT_SECRET', newSecret);
    
    if (updated) {
      serverLogger.info('JWT_SECRET 자동 생성 완료', {
        envFile: envPath,
        secretLength: newSecret.length,
        warning: '서버를 재시작해주세요.'
      });
      
      // 환경 변수 업데이트 (현재 세션용)
      process.env.JWT_SECRET = newSecret;
      
      return newSecret;
    } else {
      serverLogger.error('JWT_SECRET 자동 생성 실패 - .env 파일 업데이트 오류');
      throw new Error('JWT_SECRET 자동 생성에 실패했습니다.');
    }
  }

  // 기존 시크릿이 유효하면 그대로 사용
  if (jwtSecret.length >= 32) {
    serverLogger.debug('기존 JWT_SECRET 사용', {
      secretLength: jwtSecret.length,
      source: process.env.JWT_SECRET ? 'environment' : 'file'
    });
    return jwtSecret;
  }

  // 시크릿이 너무 짧으면 새로 생성
  const newSecret = generateJWTSecret(64);
  updateEnvFile(envPath, 'JWT_SECRET', newSecret);
  process.env.JWT_SECRET = newSecret;
  
  serverLogger.warn('기존 JWT_SECRET이 너무 짧아 새로 생성했습니다', {
    oldLength: jwtSecret.length,
    newLength: newSecret.length
  });

  return newSecret;
}

/**
 * NextAuth Secret 자동 생성
 */
export function ensureNextAuthSecret(): string {
  const envPath = findEnvFile();
  
  let nextAuthSecret = process.env.NEXTAUTH_SECRET || readEnvValue(envPath, 'NEXTAUTH_SECRET');

  if (!nextAuthSecret || nextAuthSecret.length < 32 || nextAuthSecret.includes('your-')) {
    const newSecret = generateJWTSecret(64);
    updateEnvFile(envPath, 'NEXTAUTH_SECRET', newSecret);
    process.env.NEXTAUTH_SECRET = newSecret;
    
    serverLogger.info('NEXTAUTH_SECRET 자동 생성 완료', {
      envFile: envPath,
      secretLength: newSecret.length
    });
    
    return newSecret;
  }

  return nextAuthSecret;
}

/**
 * 모든 필수 시크릿 키 자동 생성
 */
export function ensureAllSecrets(): { jwtSecret: string; nextAuthSecret: string } {
  try {
    const jwtSecret = ensureJWTSecret();
    const nextAuthSecret = ensureNextAuthSecret();
    
    serverLogger.info('모든 보안 키 검증 완료', {
      jwtSecretLength: jwtSecret.length,
      nextAuthSecretLength: nextAuthSecret.length,
      status: 'ready'
    });

    return { jwtSecret, nextAuthSecret };
  } catch (error) {
    serverLogger.fatal('보안 키 자동 생성 실패', error as Error);
    throw error;
  }
} 