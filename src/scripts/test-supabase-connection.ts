import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { SupabaseConnectionChecker } from '../utils/database';

// 환경 변수 로드
dotenv.config();

async function testSupabaseConnection() {
  console.log('🧪 Supabase 연결 테스트 시작...\n');
  
  const prisma = new PrismaClient({
    log: ['warn', 'error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  const checker = new SupabaseConnectionChecker(prisma);

  try {
    // 1. 기본 연결 테스트
    console.log('1️⃣ 기본 연결 테스트...');
    const isConnected = await checker.isConnected();
    console.log(`   결과: ${isConnected ? '✅ 성공' : '❌ 실패'}\n`);

    if (!isConnected) {
      console.log('❌ 기본 연결에 실패했습니다. 환경 변수를 확인해주세요.');
      process.exit(1);
    }

    // 2. 상세 정보 조회
    console.log('2️⃣ 데이터베이스 정보 조회...');
    const info = await checker.getConnectionInfo();
    if (info.connected) {
      console.log(`   📊 데이터베이스: ${info.info.database_name}`);
      console.log(`   👤 사용자: ${info.info.user_name}`);
      console.log(`   🌐 서버 IP: ${info.info.server_ip || 'N/A'}`);
      console.log(`   🔌 포트: ${info.info.server_port || 'N/A'}`);
      console.log(`   🔧 버전: ${info.info.version.split(' ')[0]} ${info.info.version.split(' ')[1]}`);
      console.log(`   ⏰ 서버 시간: ${info.info.current_time}\n`);
    }

    // 3. 테이블 목록 조회
    console.log('3️⃣ 테이블 목록 조회...');
    const tables = await checker.getTables();
    if (tables.success) {
      console.log(`   📋 총 ${tables.count}개의 테이블 발견`);
      if (tables.count > 0) {
        tables.tables.forEach((table: any, index: number) => {
          console.log(`      ${index + 1}. ${table.table_name} (${table.table_type})`);
        });
      } else {
        console.log('   ⚠️  테이블이 없습니다. Prisma 마이그레이션을 실행해주세요.');
      }
      console.log('');
    }

    // 4. 성능 테스트
    console.log('4️⃣ 성능 테스트...');
    const performance = await checker.performanceTest();
    if (performance.success) {
      console.log(`   ⚡ 응답 시간: ${performance.responseTime}ms`);
      if (performance.responseTime < 200) {
        console.log('   🚀 매우 빠름');
      } else if (performance.responseTime < 500) {
        console.log('   ✅ 양호');
      } else {
        console.log('   ⚠️  느림 - 네트워크 상태를 확인해주세요');
      }
    }
    console.log('');

    // 5. 종합 결과
    console.log('🎉 모든 테스트 완료!');
    console.log('✅ Supabase 연결이 정상적으로 작동합니다.');
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 데이터베이스 연결 종료');
  }
}

// 스크립트 실행
if (require.main === module) {
  testSupabaseConnection()
    .then(() => {
      console.log('\n✨ 테스트 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 테스트 실패:', error);
      process.exit(1);
    });
} 