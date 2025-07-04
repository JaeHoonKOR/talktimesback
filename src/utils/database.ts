import { PrismaClient } from '@prisma/client';

// 글로벌 Prisma 클라이언트 관리
let globalPrisma: PrismaClient | undefined;

// Prisma 클라이언트 생성 함수
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: [
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });
}

// Prisma 클라이언트 싱글톤 관리
export function getPrismaClient(): PrismaClient {
  if (!globalPrisma) {
    globalPrisma = createPrismaClient();
  }
  return globalPrisma;
}

// 연결 정보 인터페이스
interface ConnectionInfo {
  database_name: string;
  user_name: string;
  server_ip: string;
  server_port: number;
  version: string;
  current_time: string;
}

// 테이블 정보 인터페이스
interface TableInfo {
  table_name: string;
  table_type: string;
  table_schema: string;
}

// 테이블 카운트 인터페이스
interface TableCountResult {
  table_count: number;
}

// 타입 가드 함수들
function isConnectionInfoArray(result: any): result is ConnectionInfo[] {
  return Array.isArray(result) && result.length > 0 && 'database_name' in result[0];
}

function isTableCountResultArray(result: any): result is TableCountResult[] {
  return Array.isArray(result) && result.length > 0 && 'table_count' in result[0];
}

// Supabase 연결 상태 확인 유틸리티
export class SupabaseConnectionChecker {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    // 외부에서 Prisma 클라이언트 주입 가능, 없으면 새로 생성
    this.prisma = prisma || createPrismaClient();
  }

  // 간단한 연결 확인 (prepared statement 문제 해결)
  async isConnected(): Promise<boolean> {
    try {
      // $executeRaw 사용으로 prepared statement 문제 해결
      await this.prisma.$executeRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('데이터베이스 연결 실패:', error);
      return false;
    } finally {
      // 연결 종료
      await this.prisma.$disconnect();
    }
  }

  // 상세한 연결 정보 조회
  async getConnectionInfo() {
    const tempPrisma = createPrismaClient();
    
    try {
      const result = await tempPrisma.$executeRaw<ConnectionInfo[]>`
        SELECT 
          current_database() as database_name,
          current_user as user_name,
          inet_server_addr()::text as server_ip,
          inet_server_port() as server_port,
          version() as version,
          now()::text as current_time
      `;

      return {
        connected: true,
        info: isConnectionInfoArray(result) ? result[0] : undefined,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('연결 정보 조회 실패:', error);
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    } finally {
      await tempPrisma.$disconnect();
    }
  }

  // 테이블 목록 조회
  async getTables() {
    const tempPrisma = createPrismaClient();
    
    try {
      const tables = await tempPrisma.$executeRaw<TableInfo[]>`
        SELECT 
          table_name,
          table_type,
          table_schema
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;

      return {
        success: true,
        tables: tables,
        count: tables.length
      };
    } catch (error) {
      console.error('테이블 목록 조회 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tables: [],
        count: 0
      };
    } finally {
      await tempPrisma.$disconnect();
    }
  }

  // 데이터베이스 통계 정보
  async getDatabaseStats() {
    const tempPrisma = createPrismaClient();
    
    try {
      const stats = await tempPrisma.$executeRaw<any[]>`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        LIMIT 10
      `;

      const tableCount = await tempPrisma.$executeRaw<TableCountResult[]>`
        SELECT COUNT(*) as table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;

      return {
        success: true,
        tableCount: isTableCountResultArray(tableCount) ? tableCount[0].table_count : 0,
        sampleStats: stats
      };
    } catch (error) {
      console.error('데이터베이스 통계 조회 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      await tempPrisma.$disconnect();
    }
  }

  // 연결 성능 테스트
  async performanceTest() {
    const tempPrisma = createPrismaClient();
    const startTime = Date.now();
    
    try {
      await tempPrisma.$executeRaw`SELECT pg_sleep(0.1)`;
      const endTime = Date.now();
      
      return {
        success: true,
        responseTime: endTime - startTime,
        status: 'healthy'
      };
    } catch (error) {
      const endTime = Date.now();
      
      console.error('성능 테스트 실패:', error);
      return {
        success: false,
        responseTime: endTime - startTime,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      await tempPrisma.$disconnect();
    }
  }

  // 종합 헬스체크
  async fullHealthCheck() {
    console.log('🏥 Supabase 종합 헬스체크 시작...');
    
    try {
      const results = {
        connection: await this.getConnectionInfo(),
        tables: await this.getTables(),
        stats: await this.getDatabaseStats(),
        performance: await this.performanceTest()
      };

      // 결과 출력
      if (results.connection.connected) {
        console.log('✅ 연결 상태: 정상');
        console.log(`📊 데이터베이스: ${results.connection.info?.database_name}`);
        console.log(`👤 사용자: ${results.connection.info?.user_name}`);
        console.log(`🔧 PostgreSQL 버전: ${results.connection.info?.version.split(' ')[0]} ${results.connection.info?.version.split(' ')[1]}`);
      } else {
        console.log('❌ 연결 상태: 실패');
        console.log(`🔍 오류: ${results.connection.error}`);
      }

      if (results.tables.success) {
        console.log(`📋 테이블 수: ${results.tables.count}개`);
        if (results.tables.count > 0 && Array.isArray(results.tables.tables)) {
          console.log('📝 테이블 목록:');
          results.tables.tables.forEach((table: TableInfo, index: number) => {
            console.log(`   ${index + 1}. ${table.table_name} (${table.table_type})`);
          });
        }
      }

      if (results.performance.success) {
        console.log(`⚡ 응답 시간: ${results.performance.responseTime}ms`);
      }

      console.log('🏥 헬스체크 완료\n');
      
      return results;
    } catch (error) {
      console.error('종합 헬스체크 중 예기치 않은 오류:', error);
      throw error;
    }
  }
}

// 간단한 연결 확인 함수 (export)
export async function checkSupabaseConnection(prisma?: PrismaClient): Promise<boolean> {
  const checker = new SupabaseConnectionChecker(prisma);
  return await checker.isConnected();
}

// 상세 연결 정보 함수 (export)
export async function getSupabaseInfo(prisma?: PrismaClient) {
  const checker = new SupabaseConnectionChecker(prisma);
  return await checker.getConnectionInfo();
} 