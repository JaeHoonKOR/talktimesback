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
exports.runAuthMigration = runAuthMigration;
const fs_1 = require("fs");
const path_1 = require("path");
const database_manager_1 = require("../utils/database-manager");
const logger_1 = require("../utils/logger");
/**
 * 인증 보안 강화 마이그레이션 실행 스크립트
 */
function runAuthMigration() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger_1.serverLogger.info('인증 보안 강화 마이그레이션 시작...');
            // 데이터베이스 연결
            yield database_manager_1.dbManager.initialize();
            // 마이그레이션 파일 읽기
            const migrationPath = (0, path_1.join)(__dirname, '../../prisma/migrations/create_auth_security_tables.sql');
            const migrationSQL = (0, fs_1.readFileSync)(migrationPath, 'utf8');
            // SQL을 세미콜론으로 분할하여 각각 실행
            const statements = migrationSQL
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            logger_1.serverLogger.info(`실행할 SQL 문장 수: ${statements.length}`);
            // 각 SQL 문장 실행
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                try {
                    logger_1.serverLogger.debug(`SQL 문장 ${i + 1}/${statements.length} 실행 중...`);
                    yield database_manager_1.dbManager.prisma.$executeRawUnsafe(statement);
                    logger_1.serverLogger.debug(`SQL 문장 ${i + 1} 실행 완료`);
                }
                catch (error) {
                    // CREATE TABLE IF NOT EXISTS 같은 경우 이미 존재해도 계속 진행
                    if (statement.includes('IF NOT EXISTS') ||
                        error.message.includes('already exists')) {
                        logger_1.serverLogger.warn(`테이블이 이미 존재함: ${error.message}`);
                        continue;
                    }
                    logger_1.serverLogger.error(`SQL 문장 실행 실패 (${i + 1}/${statements.length})`, error);
                    throw error;
                }
            }
            // 추가 보안 설정 확인
            yield validateSecurityTables();
            logger_1.serverLogger.info('✅ 인증 보안 강화 마이그레이션이 성공적으로 완료되었습니다!');
            // 마이그레이션 결과 요약
            const summary = yield getMigrationSummary();
            logger_1.serverLogger.info('마이그레이션 결과 요약:', summary);
        }
        catch (error) {
            logger_1.serverLogger.error('❌ 마이그레이션 실행 실패:', error);
            throw error;
        }
    });
}
/**
 * 보안 테이블들이 올바르게 생성되었는지 검증
 */
function validateSecurityTables() {
    return __awaiter(this, void 0, void 0, function* () {
        const requiredTables = [
            'token_blacklist',
            'refresh_tokens',
            'login_attempts',
            'user_security_settings',
            'active_sessions',
            'security_events'
        ];
        logger_1.serverLogger.info('보안 테이블 생성 상태 검증 중...');
        for (const tableName of requiredTables) {
            try {
                const result = yield database_manager_1.dbManager.prisma.$queryRaw `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      `;
                if (result.length > 0) {
                    logger_1.serverLogger.info(`✅ 테이블 '${tableName}' 생성 확인`);
                }
                else {
                    throw new Error(`테이블 '${tableName}'이 생성되지 않았습니다.`);
                }
            }
            catch (error) {
                logger_1.serverLogger.error(`❌ 테이블 '${tableName}' 검증 실패:`, error);
                throw error;
            }
        }
        logger_1.serverLogger.info('✅ 모든 보안 테이블이 성공적으로 생성되었습니다.');
    });
}
/**
 * 마이그레이션 결과 요약
 */
function getMigrationSummary() {
    return __awaiter(this, void 0, void 0, function* () {
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
            const summary = {};
            for (const table of tables) {
                try {
                    const result = yield database_manager_1.dbManager.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table}`);
                    summary[table] = parseInt(result[0].count) || 0;
                }
                catch (error) {
                    summary[table] = -1; // 오류 표시
                }
            }
            return {
                tablesCreated: Object.keys(summary).length,
                initialRecords: summary,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    });
}
/**
 * 스크립트 실행
 */
if (require.main === module) {
    runAuthMigration()
        .then(() => {
        logger_1.serverLogger.info('🎉 마이그레이션 스크립트 실행 완료');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.serverLogger.error('💥 마이그레이션 스크립트 실행 실패:', error);
        process.exit(1);
    });
}
