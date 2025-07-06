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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("../utils/database");
// 환경 변수 로드
dotenv_1.default.config();
function testSupabaseConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        console.log('🧪 Supabase 연결 테스트 시작...\n');
        const prisma = new client_1.PrismaClient({
            log: ['warn', 'error'],
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
        });
        const checker = new database_1.SupabaseConnectionChecker(prisma);
        try {
            // 1. 기본 연결 테스트
            console.log('1️⃣ 기본 연결 테스트...');
            const isConnected = yield checker.isConnected();
            console.log(`   결과: ${isConnected ? '✅ 성공' : '❌ 실패'}\n`);
            if (!isConnected) {
                console.log('❌ 기본 연결에 실패했습니다. 환경 변수를 확인해주세요.');
                process.exit(1);
            }
            // 2. 상세 정보 조회
            console.log('2️⃣ 데이터베이스 정보 조회...');
            const info = yield checker.getConnectionInfo();
            if (info.connected) {
                console.log(`   📊 데이터베이스: ${((_a = info.info) === null || _a === void 0 ? void 0 : _a.database_name) || 'N/A'}`);
                console.log(`   👤 사용자: ${((_b = info.info) === null || _b === void 0 ? void 0 : _b.user_name) || 'N/A'}`);
                console.log(`   🌐 서버 IP: ${((_c = info.info) === null || _c === void 0 ? void 0 : _c.server_ip) || 'N/A'}`);
                console.log(`   🔌 포트: ${((_d = info.info) === null || _d === void 0 ? void 0 : _d.server_port) || 'N/A'}`);
                console.log(`   🔧 버전: ${((_f = (_e = info.info) === null || _e === void 0 ? void 0 : _e.version) === null || _f === void 0 ? void 0 : _f.split(' ')[0]) || 'N/A'} ${((_h = (_g = info.info) === null || _g === void 0 ? void 0 : _g.version) === null || _h === void 0 ? void 0 : _h.split(' ')[1]) || ''}`);
                console.log(`   ⏰ 서버 시간: ${((_j = info.info) === null || _j === void 0 ? void 0 : _j.current_time) || 'N/A'}\n`);
            }
            // 3. 테이블 목록 조회
            console.log('3️⃣ 테이블 목록 조회...');
            const tables = yield checker.getTables();
            if (tables.success) {
                console.log(`   📋 총 ${tables.count}개의 테이블 발견`);
                if (tables.count > 0) {
                    if (Array.isArray(tables.tables)) {
                        tables.tables.forEach((table, index) => {
                            console.log(`      ${index + 1}. ${table.table_name} (${table.table_type})`);
                        });
                    }
                    else {
                        console.log('   ⚠️  테이블이 없습니다. Prisma 마이그레이션을 실행해주세요.');
                    }
                }
                else {
                    console.log('   ⚠️  테이블이 없습니다. Prisma 마이그레이션을 실행해주세요.');
                }
                console.log('');
            }
            // 4. 성능 테스트
            console.log('4️⃣ 성능 테스트...');
            const performance = yield checker.performanceTest();
            if (performance.success) {
                console.log(`   ⚡ 응답 시간: ${performance.responseTime}ms`);
                if (performance.responseTime < 200) {
                    console.log('   🚀 매우 빠름');
                }
                else if (performance.responseTime < 500) {
                    console.log('   ✅ 양호');
                }
                else {
                    console.log('   ⚠️  느림 - 네트워크 상태를 확인해주세요');
                }
            }
            console.log('');
            // 5. 종합 결과
            console.log('🎉 모든 테스트 완료!');
            console.log('✅ Supabase 연결이 정상적으로 작동합니다.');
        }
        catch (error) {
            console.error('❌ 테스트 중 오류 발생:', error);
            process.exit(1);
        }
        finally {
            yield prisma.$disconnect();
            console.log('🔌 데이터베이스 연결 종료');
        }
    });
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
