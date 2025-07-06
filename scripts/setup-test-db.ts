import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

// 환경 변수 로드
dotenv.config({
  path: path.join(__dirname, '..', '.env.test')
});

async function setupTestDatabase() {
  console.log('테스트 데이터베이스 설정을 시작합니다...');

  try {
    // Prisma 스키마 적용
    console.log('Prisma 스키마를 적용합니다...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    // Prisma 클라이언트 생성
    console.log('Prisma 클라이언트를 생성합니다...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // 데이터베이스 연결 테스트
    console.log('데이터베이스 연결을 테스트합니다...');
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('데이터베이스 연결 성공!');
    await prisma.$disconnect();

    console.log('테스트 데이터베이스 설정이 완료되었습니다.');
  } catch (error) {
    console.error('테스트 데이터베이스 설정 중 오류가 발생했습니다:', error);
    process.exit(1);
  }
}

setupTestDatabase(); 