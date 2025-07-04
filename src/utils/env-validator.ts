import { serverLogger } from './logger';
import { ensureAllSecrets } from './jwt-secret-generator';

/**
 * 필수 환경 변수 목록
 */
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'NEXTAUTH_SECRET'
] as const;

/**
 * 권장 환경 변수 목록 (경고만 출력)
 */
const RECOMMENDED_ENV_VARS = [
  'GOOGLE_TRANSLATE_API_KEY',
  'OPENAI_API_KEY',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'DB_CONNECTION_LIMIT',
  'DB_QUERY_TIMEOUT',
  'DB_TRANSACTION_TIMEOUT'
] as const;

/**
 * 보안 관련 환경 변수의 최소 요구사항
 */
const SECURITY_REQUIREMENTS = {
  JWT_SECRET: {
    minLength: 32,
    description: 'JWT 시크릿 키는 최소 32자 이상이어야 합니다.'
  },
  NEXTAUTH_SECRET: {
    minLength: 32,
    description: 'NextAuth 시크릿 키는 최소 32자 이상이어야 합니다.'
  }
} as const;

/**
 * 환경 변수 검증 함수
 */
export function validateEnvironmentVariables(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 보안 키 자동 생성 (JWT_SECRET, NEXTAUTH_SECRET)
  try {
    const secrets = ensureAllSecrets();
    serverLogger.info('보안 키 자동 검증/생성 완료', {
      jwtSecretLength: secrets.jwtSecret.length,
      nextAuthSecretLength: secrets.nextAuthSecret.length,
      status: 'ready'
    });
  } catch (error) {
    errors.push(`보안 키 자동 생성 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 필수 환경 변수 검증
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar];
    
    if (!value) {
      // JWT_SECRET과 NEXTAUTH_SECRET은 이미 자동 생성했으므로 스킵
      if (envVar === 'JWT_SECRET' || envVar === 'NEXTAUTH_SECRET') {
        continue;
      }
      errors.push(`필수 환경 변수가 설정되지 않았습니다: ${envVar}`);
      continue;
    }

    // 보안 요구사항 검증
    if (envVar in SECURITY_REQUIREMENTS) {
      const requirement = SECURITY_REQUIREMENTS[envVar as keyof typeof SECURITY_REQUIREMENTS];
      if (value.length < requirement.minLength) {
        errors.push(`${envVar}: ${requirement.description} (현재 길이: ${value.length})`);
      }
    }

    // 기본값 사용 검증
    if (value.includes('your-') || value.includes('example') || value.includes('localhost')) {
      warnings.push(`${envVar}에 기본값이나 예시값이 설정되어 있습니다. 프로덕션 환경에서는 실제 값으로 변경하세요.`);
    }
  }

  // 권장 환경 변수 검증
  for (const envVar of RECOMMENDED_ENV_VARS) {
    const value = process.env[envVar];
    
    if (!value) {
      warnings.push(`권장 환경 변수가 설정되지 않았습니다: ${envVar} (해당 기능이 제한될 수 있습니다)`);
    }
  }

  // 에러가 있는 경우 서버 시작 중단
  if (errors.length > 0) {
    serverLogger.error('환경 변수 검증 실패', new Error('필수 환경 변수 누락'), {
      errors,
      warnings
    });
    
    console.error('\n=== 환경 변수 검증 실패 ===');
    console.error('다음 필수 환경 변수들이 올바르게 설정되지 않았습니다:');
    errors.forEach(error => console.error(`- ${error}`));
    
    if (warnings.length > 0) {
      console.warn('\n경고사항:');
      warnings.forEach(warning => console.warn(`- ${warning}`));
    }
    
    console.error('\n서버를 시작하기 전에 .env 파일을 확인하고 필요한 환경 변수를 설정하세요.');
    process.exit(1);
  }

  // 경고만 출력
  if (warnings.length > 0) {
    serverLogger.warn('환경 변수 검증 경고', {
      warnings
    });
    
    console.warn('\n=== 환경 변수 검증 경고 ===');
    warnings.forEach(warning => console.warn(`- ${warning}`));
  }

  serverLogger.info('환경 변수 검증 완료', {
    requiredVarsCount: REQUIRED_ENV_VARS.length,
    recommendedVarsCount: RECOMMENDED_ENV_VARS.length,
    warningsCount: warnings.length
  });
}

/**
 * 환경 변수 값 마스킹 (로깅용)
 */
export function maskSensitiveValue(key: string, value: string): string {
  const sensitiveKeys = ['SECRET', 'KEY', 'PASSWORD', 'TOKEN', 'PASS'];
  
  if (sensitiveKeys.some(sensitive => key.toUpperCase().includes(sensitive))) {
    if (value.length <= 4) {
      return '***';
    }
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }
  
  return value;
} 