import { readFileSync } from 'fs';
import { join } from 'path';
import { dbManager } from '../utils/database-manager';
import { serverLogger } from '../utils/logger';

/**
 * 인증 보안 강화 마이그레이션 실행 스크립트
 */
async function runAuthMigration(): Promise<void> {
  try {
    serverLogger.info('인증 보안 강화 마이그레이션 시작...');

    // 데이터베이스 연결
    await dbManager.initialize();

    // 마이그레이션 파일 읽기
    const migrationPath = join(__dirname, '../../prisma/migrations/create_auth_security_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // SQL을 세미콜론으로 분할하여 각각 실행
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    serverLogger.info(`실행할 SQL 문장 수: ${statements.length}`);

    // 각 SQL 문장 실행
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        serverLogger.debug(`SQL 문장 ${i + 1}/${statements.length} 실행 중...`);
        await dbManager.prisma.$executeRawUnsafe(statement);
        serverLogger.debug(`SQL 문장 ${i + 1} 실행 완료`);
      } catch (error) {
        // CREATE TABLE IF NOT EXISTS 같은 경우 이미 존재해도 계속 진행
        if (statement.includes('IF NOT EXISTS') || 
            (error as Error).message.includes('already exists')) {
          serverLogger.warn(`테이블이 이미 존재함: ${(error as Error).message}`);
          continue;
        }
        
        serverLogger.error(`SQL 문장 실행 실패 (${i + 1}/${statements.length})`, error as Error);
        throw error;
      }
    }

    // 추가 보안 설정 확인
    await validateSecurityTables();

    serverLogger.info('✅ 인증 보안 강화 마이그레이션이 성공적으로 완료되었습니다!');

    // 마이그레이션 결과 요약
    const summary = await getMigrationSummary();
    serverLogger.info('마이그레이션 결과 요약:', summary);

  } catch (error) {
    serverLogger.error('❌ 마이그레이션 실행 실패:', error as Error);
    throw error;
  }
}

/**
 * 보안 테이블들이 올바르게 생성되었는지 검증
 */
async function validateSecurityTables(): Promise<void> {
  
  const requiredTables = [
    'token_blacklist',
    'refresh_tokens', 
    'login_attempts',
    'user_security_settings',
    'active_sessions',
    'security_events'
  ];

  serverLogger.info('보안 테이블 생성 상태 검증 중...');

  for (const tableName of requiredTables) {
    try {
      const result = await dbManager.prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ` as any[];

      if (result.length > 0) {
        serverLogger.info(`✅ 테이블 '${tableName}' 생성 확인`);
      } else {
        throw new Error(`테이블 '${tableName}'이 생성되지 않았습니다.`);
      }
    } catch (error) {
      serverLogger.error(`❌ 테이블 '${tableName}' 검증 실패:`, error as Error);
      throw error;
    }
  }

  serverLogger.info('✅ 모든 보안 테이블이 성공적으로 생성되었습니다.');
}

/**
 * 마이그레이션 결과 요약
 */
async function getMigrationSummary(): Promise<Record<string, any>> {
  
  try {
    // 각 테이블의 레코드 수 확인
    const tables = [
      'token_blacklist',
      'refresh_tokens',
      'login_attempts', 
      'user_security_settings',
      'active_sessions',
      'security_events'
    ];

    const summary: Record<string, number> = {};

    for (const table of tables) {
      try {
        const result = await dbManager.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table}`) as any[];
        summary[table] = parseInt(result[0].count) || 0;
      } catch (error) {
        summary[table] = -1; // 오류 표시
      }
    }

    return {
      tablesCreated: Object.keys(summary).length,
      initialRecords: summary,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 스크립트 실행
 */
if (require.main === module) {
  runAuthMigration()
    .then(() => {
      serverLogger.info('🎉 마이그레이션 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      serverLogger.error('💥 마이그레이션 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export { runAuthMigration };
 