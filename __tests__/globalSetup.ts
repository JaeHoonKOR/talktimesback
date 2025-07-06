import dotenv from 'dotenv';
import path from 'path';

/**
 * 전역 테스트 설정 - 모든 테스트 실행 전에 한 번만 실행됩니다.
 */
export default async function globalSetup() {
  console.log('🔧 Jest 전역 설정 시작...');
  
  // 테스트 환경 변수 로드
  dotenv.config({
    path: path.join(__dirname, '..', '.env.test')
  });
  
  // 필수 환경 변수 설정
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-32-characters-long-abcdefghijklmnopqrstuvwxyz';
  process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-key-for-testing-only-32-characters-long-abcdefghijklmnopqrstuvwxyz';
  
  // 테스트 데이터베이스 URL 설정
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/jiksend_test';
  }
  
  // 외부 API 키 설정 (테스트용)
  process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-translate-api-key';
  process.env.OPENAI_API_KEY = 'test-openai-api-key';
  
  // 테스트 환경 검증
  console.log('📋 테스트 환경 검증 중...');
  
  const requiredEnvVars = [
    'NODE_ENV',
    'JWT_SECRET',
    'NEXTAUTH_SECRET',
    'DATABASE_URL'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 필수 환경 변수가 누락되었습니다:', missingVars);
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  // 데이터베이스 연결 테스트 (실제 연결하지 않고 URL 형식만 확인)
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl.startsWith('postgresql://')) {
    console.warn('⚠️  DATABASE_URL이 PostgreSQL 형식이 아닙니다. 일부 테스트가 실패할 수 있습니다.');
  }
  
  console.log('✅ 전역 테스트 설정 완료');
  console.log(`🗃️  데이터베이스: ${dbUrl.split('@')[1] || 'URL 파싱 실패'}`);
  console.log(`🔑 JWT 시크릿 길이: ${process.env.JWT_SECRET.length}자`);
  console.log('🚀 테스트 실행 준비 완료!\n');
} 