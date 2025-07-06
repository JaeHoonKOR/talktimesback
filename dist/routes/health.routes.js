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
const express_1 = require("express");
const server_1 = require("../server");
const api_types_1 = require("../types/api.types");
const database_1 = require("../utils/database");
const response_helper_1 = require("../utils/response.helper");
const router = (0, express_1.Router)();
const connectionChecker = new database_1.SupabaseConnectionChecker(server_1.prisma);
// =============================================================================
// 헬스체크 엔드포인트 (RESTful)
// =============================================================================
/**
 * GET /health
 * 기본 헬스체크
 */
router.get('/', (req, res) => {
    const healthData = {
        status: 'healthy',
        message: 'JikSend API 서버가 정상적으로 실행 중입니다.',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    };
    response_helper_1.ResponseHelper.success(res, healthData);
});
/**
 * GET /health/database
 * 데이터베이스 연결 상태 확인
 */
router.get('/database', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const isConnected = yield connectionChecker.isConnected();
        if (isConnected) {
            const info = yield connectionChecker.getConnectionInfo();
            const healthData = {
                status: 'healthy',
                message: 'Supabase 데이터베이스 연결이 정상입니다.',
                database: (_a = info.info) === null || _a === void 0 ? void 0 : _a.database_name,
                user: (_b = info.info) === null || _b === void 0 ? void 0 : _b.user_name,
                timestamp: new Date().toISOString()
            };
            response_helper_1.ResponseHelper.success(res, healthData);
        }
        else {
            const healthData = {
                status: 'unhealthy',
                message: 'Supabase 데이터베이스 연결에 실패했습니다.',
                timestamp: new Date().toISOString()
            };
            response_helper_1.ResponseHelper.error(res, api_types_1.ErrorCode.DATABASE_ERROR, healthData.message, healthData);
        }
    }
    catch (error) {
        const healthData = {
            status: 'unhealthy',
            message: 'Supabase 데이터베이스 연결 확인 중 오류가 발생했습니다.',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };
        response_helper_1.ResponseHelper.databaseError(res, healthData.message, healthData);
    }
}));
/**
 * GET /health/database/info
 * 상세 데이터베이스 정보
 */
router.get('/database/info', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const info = yield connectionChecker.getConnectionInfo();
        const tables = yield connectionChecker.getTables();
        const performance = yield connectionChecker.performanceTest();
        const healthData = {
            status: info.connected ? 'healthy' : 'unhealthy',
            connection: info,
            tables: tables,
            performance: performance,
            timestamp: new Date().toISOString()
        };
        if (info.connected) {
            response_helper_1.ResponseHelper.success(res, healthData);
        }
        else {
            response_helper_1.ResponseHelper.databaseError(res, '데이터베이스 연결 실패', healthData);
        }
    }
    catch (error) {
        response_helper_1.ResponseHelper.internalServerError(res, '데이터베이스 정보 조회 중 오류가 발생했습니다.', {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}));
/**
 * GET /health/full
 * 종합 헬스체크
 */
router.get('/full', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const results = yield connectionChecker.fullHealthCheck();
        const overallStatus = results.connection.connected &&
            results.tables.success &&
            results.performance.success ? 'healthy' : 'unhealthy';
        const healthData = {
            status: overallStatus,
            message: `종합 헬스체크 ${overallStatus === 'healthy' ? '성공' : '실패'}`,
            results: results,
            timestamp: new Date().toISOString()
        };
        if (overallStatus === 'healthy') {
            response_helper_1.ResponseHelper.success(res, healthData);
        }
        else {
            response_helper_1.ResponseHelper.error(res, api_types_1.ErrorCode.SYSTEM_ERROR, healthData.message, healthData);
        }
    }
    catch (error) {
        response_helper_1.ResponseHelper.internalServerError(res, '종합 헬스체크 중 오류가 발생했습니다.', {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}));
/**
 * GET /health/database/tables
 * 테이블 목록 조회
 */
router.get('/database/tables', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tables = yield connectionChecker.getTables();
        const healthData = {
            status: tables.success ? 'success' : 'error',
            message: `테이블 ${tables.count}개 조회 ${tables.success ? '성공' : '실패'}`,
            data: tables,
            timestamp: new Date().toISOString()
        };
        if (tables.success) {
            response_helper_1.ResponseHelper.success(res, healthData);
        }
        else {
            response_helper_1.ResponseHelper.databaseError(res, healthData.message, healthData);
        }
    }
    catch (error) {
        response_helper_1.ResponseHelper.internalServerError(res, '테이블 목록 조회 중 오류가 발생했습니다.', {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}));
/**
 * GET /health/database/performance
 * 성능 테스트
 */
router.get('/database/performance', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const performance = yield connectionChecker.performanceTest();
        const healthData = {
            status: performance.status,
            message: `성능 테스트 ${performance.success ? '성공' : '실패'}`,
            responseTime: `${performance.responseTime}ms`,
            data: performance,
            timestamp: new Date().toISOString()
        };
        if (performance.success) {
            response_helper_1.ResponseHelper.success(res, healthData);
        }
        else {
            response_helper_1.ResponseHelper.databaseError(res, healthData.message, healthData);
        }
    }
    catch (error) {
        response_helper_1.ResponseHelper.internalServerError(res, '성능 테스트 중 오류가 발생했습니다.', {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}));
exports.default = router;
