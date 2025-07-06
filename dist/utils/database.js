"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseConnectionChecker = void 0;
exports.getPrismaClient = getPrismaClient;
exports.checkSupabaseConnection = checkSupabaseConnection;
exports.getSupabaseInfo = getSupabaseInfo;
const client_1 = require("@prisma/client");
// 글로벌 Prisma 클라이언트 관리
let globalPrisma;
// Prisma 클라이언트 생성 함수
function createPrismaClient() {
    return new client_1.PrismaClient({
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
function getPrismaClient() {
    if (!globalPrisma) {
        globalPrisma = createPrismaClient();
    }
    return globalPrisma;
}
// 타입 가드 함수들
function isConnectionInfoArray(result) {
    return Array.isArray(result) && result.length > 0 && 'database_name' in result[0];
}
function isTableCountResultArray(result) {
    return Array.isArray(result) && result.length > 0 && 'table_count' in result[0];
}
// Supabase 연결 상태 확인 유틸리티
class SupabaseConnectionChecker {
    constructor(prisma) {
        // 외부에서 Prisma 클라이언트 주입 가능, 없으면 새로 생성
        this.prisma = prisma || createPrismaClient();
    }
    // 간단한 연결 확인 (prepared statement 문제 해결)
    isConnected() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // $executeRaw 사용으로 prepared statement 문제 해결
                yield this.prisma.$executeRaw `SELECT 1`;
                return true;
            }
            catch (error) {
                console.error('데이터베이스 연결 실패:', error);
                return false;
            }
            finally {
                // 연결 종료
                yield this.prisma.$disconnect();
            }
        });
    }
    // 상세한 연결 정보 조회
    getConnectionInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const tempPrisma = createPrismaClient();
            try {
                const result = yield tempPrisma.$executeRaw `
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
            }
            catch (error) {
                console.error('연결 정보 조회 실패:', error);
                return {
                    connected: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                };
            }
            finally {
                yield tempPrisma.$disconnect();
            }
        });
    }
    // 테이블 목록 조회
    getTables() {
        return __awaiter(this, void 0, void 0, function* () {
            const tempPrisma = createPrismaClient();
            try {
                const tables = yield tempPrisma.$executeRaw `
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
                    count: Array.isArray(tables) ? tables.length : 0
                };
            }
            catch (error) {
                console.error('테이블 목록 조회 실패:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    tables: [],
                    count: 0
                };
            }
            finally {
                yield tempPrisma.$disconnect();
            }
        });
    }
    // 데이터베이스 통계 정보
    getDatabaseStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const tempPrisma = createPrismaClient();
            try {
                const stats = yield tempPrisma.$executeRaw `
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
                const tableCount = yield tempPrisma.$executeRaw `
        SELECT COUNT(*) as table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
                return {
                    success: true,
                    tableCount: isTableCountResultArray(tableCount) ? tableCount[0].table_count : 0,
                    sampleStats: stats
                };
            }
            catch (error) {
                console.error('데이터베이스 통계 조회 실패:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
            finally {
                yield tempPrisma.$disconnect();
            }
        });
    }
    // 연결 성능 테스트
    performanceTest() {
        return __awaiter(this, void 0, void 0, function* () {
            const tempPrisma = createPrismaClient();
            const startTime = Date.now();
            try {
                yield tempPrisma.$executeRaw `SELECT pg_sleep(0.1)`;
                const endTime = Date.now();
                return {
                    success: true,
                    responseTime: endTime - startTime,
                    status: 'healthy'
                };
            }
            catch (error) {
                const endTime = Date.now();
                console.error('성능 테스트 실패:', error);
                return {
                    success: false,
                    responseTime: endTime - startTime,
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
            finally {
                yield tempPrisma.$disconnect();
            }
        });
    }
    // 종합 헬스체크
    fullHealthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            console.log('🏥 Supabase 종합 헬스체크 시작...');
            try {
                const results = {
                    connection: yield this.getConnectionInfo(),
                    tables: yield this.getTables(),
                    stats: yield this.getDatabaseStats(),
                    performance: yield this.performanceTest()
                };
                // 결과 출력
                if (results.connection.connected) {
                    console.log('✅ 연결 상태: 정상');
                    console.log(`📊 데이터베이스: ${(_a = results.connection.info) === null || _a === void 0 ? void 0 : _a.database_name}`);
                    console.log(`👤 사용자: ${(_b = results.connection.info) === null || _b === void 0 ? void 0 : _b.user_name}`);
                    console.log(`🔧 PostgreSQL 버전: ${(_c = results.connection.info) === null || _c === void 0 ? void 0 : _c.version.split(' ')[0]} ${(_d = results.connection.info) === null || _d === void 0 ? void 0 : _d.version.split(' ')[1]}`);
                }
                else {
                    console.log('❌ 연결 상태: 실패');
                    console.log(`🔍 오류: ${results.connection.error}`);
                }
                if (results.tables.success) {
                    console.log(`📋 테이블 수: ${results.tables.count}개`);
                    if (results.tables.count > 0 && Array.isArray(results.tables.tables)) {
                        console.log('📝 테이블 목록:');
                        results.tables.tables.forEach((table, index) => {
                            console.log(`   ${index + 1}. ${table.table_name} (${table.table_type})`);
                        });
                    }
                }
                if (results.performance.success) {
                    console.log(`⚡ 응답 시간: ${results.performance.responseTime}ms`);
                }
                console.log('🏥 헬스체크 완료\n');
                return results;
            }
            catch (error) {
                console.error('종합 헬스체크 중 예기치 않은 오류:', error);
                throw error;
            }
        });
    }
}
exports.SupabaseConnectionChecker = SupabaseConnectionChecker;
// 간단한 연결 확인 함수 (export)
function checkSupabaseConnection(prisma) {
    return __awaiter(this, void 0, void 0, function* () {
        const checker = new SupabaseConnectionChecker(prisma);
        return yield checker.isConnected();
    });
}
// 상세 연결 정보 함수 (export)
function getSupabaseInfo(prisma) {
    return __awaiter(this, void 0, void 0, function* () {
        const checker = new SupabaseConnectionChecker(prisma);
        return yield checker.getConnectionInfo();
    });
}
