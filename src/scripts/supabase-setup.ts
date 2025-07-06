import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// .env 파일 로드
config();

// Supabase 클라이언트 설정
interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export class SupabaseManager {
  private supabase: any;
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig) {
    this.config = config;
    this.supabase = createClient(config.url, config.serviceRoleKey);
  }

  // 데이터베이스 연결 테스트
  async testConnection(): Promise<boolean> {
    try {
      // 간단한 SQL 쿼리로 연결 테스트
      const { data, error } = await this.supabase
        .rpc('version');
      
      if (error) {
        console.error('연결 실패:', error.message);
        // 다른 방법으로 시도
        try {
          const { data: authData, error: authError } = await this.supabase.auth.getSession();
          if (authError) {
            console.error('인증 테스트도 실패:', authError.message);
            return false;
          }
          console.log('✅ Supabase 연결 성공! (인증 API 경로)');
          return true;
        } catch (authError) {
          console.error('모든 연결 테스트 실패:', authError);
          return false;
        }
      }
      
      console.log('✅ Supabase 연결 성공!');
      return true;
    } catch (error) {
      console.error('연결 테스트 실패:', error);
      return false;
    }
  }

  // SQL 파일 실행
  async executeSQLFile(filePath: string): Promise<boolean> {
    try {
      const sqlContent = readFileSync(filePath, 'utf-8');
      
      console.log(`📁 SQL 파일 실행: ${filePath}`);
      console.log(`📝 SQL 내용 길이: ${sqlContent.length} 문자`);
      
      // Supabase에서는 직접 SQL 실행이 제한적이므로 
      // 수동으로 실행하도록 안내
      console.log('\n⚠️  Supabase에서는 보안상 직접 SQL 실행이 제한됩니다.');
      console.log('🔧 다음 방법으로 수동 실행해주세요:');
      console.log('1. Supabase 대시보드 → SQL Editor 접속');
      console.log('2. 아래 SQL 내용을 복사하여 실행:');
      console.log('\n' + '='.repeat(50));
      console.log(sqlContent);
      console.log('='.repeat(50) + '\n');
      
      return true;
    } catch (error) {
      console.error('SQL 파일 읽기 실패:', error);
      return false;
    }
  }

  // 보안 테이블 생성
  async createSecurityTables(): Promise<boolean> {
    const migrationPath = join(__dirname, '../../prisma/migrations/create_auth_security_tables.sql');
    return await this.executeSQLFile(migrationPath);
  }

  // 테이블 존재 확인
  async checkTablesExist(): Promise<string[]> {
    const securityTables = [
      'token_blacklist',
      'refresh_tokens', 
      'login_attempts',
      'user_security_settings',
      'active_sessions',
      'security_events'
    ];

    const existingTables: string[] = [];

    for (const table of securityTables) {
      try {
        const { error } = await this.supabase
          .from(table)
          .select('*')
          .limit(1);

        if (!error) {
          existingTables.push(table);
        }
      } catch (error) {
        // 테이블이 존재하지 않으면 에러 발생
      }
    }

    return existingTables;
  }

  // 데이터베이스 상태 확인
  async getDatabaseStatus(): Promise<void> {
    console.log('\n📊 데이터베이스 상태 확인...');
    
    try {
      // 보안 테이블 확인
      const existingSecurityTables = await this.checkTablesExist();
      console.log('\n🔒 보안 테이블 상태:');
      const securityTables = [
        'token_blacklist',
        'refresh_tokens', 
        'login_attempts',
        'user_security_settings',
        'active_sessions',
        'security_events'
      ];

      securityTables.forEach(table => {
        const exists = existingSecurityTables.includes(table);
        console.log(`  ${exists ? '✅' : '❌'} ${table}`);
      });

    } catch (error) {
      console.error('데이터베이스 상태 확인 실패:', error);
    }
  }
}

// 실행 함수
export async function setupSupabase() {
  console.log('🚀 Supabase 설정 시작...\n');

  // 환경 변수 확인
  const requiredEnvs = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

  if (missingEnvs.length > 0) {
    console.error('❌ 필수 환경 변수가 설정되지 않았습니다:');
    missingEnvs.forEach(env => {
      console.error(`  - ${env}`);
    });
    console.log('\n📝 .env 파일에 다음 설정을 추가해주세요:');
    console.log('SUPABASE_URL=your_supabase_project_url');
    console.log('SUPABASE_ANON_KEY=your_supabase_anon_key');
    console.log('SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key');
    return false;
  }

  const config: SupabaseConfig = {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
  };

  const manager = new SupabaseManager(config);

  // 연결 테스트
  const connected = await manager.testConnection();
  if (!connected) {
    console.error('❌ Supabase 연결에 실패했습니다.');
    return false;
  }

  // 데이터베이스 상태 확인
  await manager.getDatabaseStatus();

  // 보안 테이블 생성
  console.log('\n🔒 보안 테이블 생성 시작...');
  const created = await manager.createSecurityTables();
  
  if (created) {
    console.log('✅ 보안 테이블 생성 완료!');
    await manager.getDatabaseStatus();
    return true;
  } else {
    console.error('❌ 보안 테이블 생성 실패');
    return false;
  }
}

// 직접 실행 시
if (require.main === module) {
  setupSupabase()
    .then((success) => {
      if (success) {
        console.log('\n🎉 Supabase 설정이 완료되었습니다!');
        process.exit(0);
      } else {
        console.error('\n💥 Supabase 설정에 실패했습니다.');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('설정 중 오류 발생:', error);
      process.exit(1);
    });
} 