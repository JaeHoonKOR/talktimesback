import { Router } from 'express';
import { prisma } from '../server';
import { ErrorCode } from '../types/api.types';
import { SupabaseConnectionChecker } from '../utils/database';
import { ResponseHelper } from '../utils/response.helper';

const router = Router();
const connectionChecker = new SupabaseConnectionChecker(prisma);

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

  ResponseHelper.success(res, healthData);
});

/**
 * GET /health/database
 * 데이터베이스 연결 상태 확인
 */
router.get('/database', async (req, res) => {
  try {
    const isConnected = await connectionChecker.isConnected();
    
    if (isConnected) {
      const info = await connectionChecker.getConnectionInfo();
      const healthData = {
        status: 'healthy',
        message: 'Supabase 데이터베이스 연결이 정상입니다.',
        database: info.info?.database_name,
        user: info.info?.user_name,
        timestamp: new Date().toISOString()
      };
      
      ResponseHelper.success(res, healthData);
    } else {
      const healthData = {
        status: 'unhealthy',
        message: 'Supabase 데이터베이스 연결에 실패했습니다.',
        timestamp: new Date().toISOString()
      };
      
      ResponseHelper.error(res, ErrorCode.DATABASE_ERROR, healthData.message, healthData);
    }
  } catch (error) {
    const healthData = {
      status: 'unhealthy',
      message: 'Supabase 데이터베이스 연결 확인 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    
    ResponseHelper.databaseError(res, healthData.message, healthData);
  }
});

/**
 * GET /health/database/info
 * 상세 데이터베이스 정보
 */
router.get('/database/info', async (req, res) => {
  try {
    const info = await connectionChecker.getConnectionInfo();
    const tables = await connectionChecker.getTables();
    const performance = await connectionChecker.performanceTest();
    
    const healthData = {
      status: info.connected ? 'healthy' : 'unhealthy',
      connection: info,
      tables: tables,
      performance: performance,
      timestamp: new Date().toISOString()
    };
    
    if (info.connected) {
      ResponseHelper.success(res, healthData);
    } else {
      ResponseHelper.databaseError(res, '데이터베이스 연결 실패', healthData);
    }
  } catch (error) {
    ResponseHelper.internalServerError(
      res, 
      '데이터베이스 정보 조회 중 오류가 발생했습니다.',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    );
  }
});

/**
 * GET /health/full
 * 종합 헬스체크
 */
router.get('/full', async (req, res) => {
  try {
    const results = await connectionChecker.fullHealthCheck();
    
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
      ResponseHelper.success(res, healthData);
    } else {
      ResponseHelper.error(res, ErrorCode.SYSTEM_ERROR, healthData.message, healthData);
    }
  } catch (error) {
    ResponseHelper.internalServerError(
      res,
      '종합 헬스체크 중 오류가 발생했습니다.',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    );
  }
});

/**
 * GET /health/database/tables
 * 테이블 목록 조회
 */
router.get('/database/tables', async (req, res) => {
  try {
    const tables = await connectionChecker.getTables();
    
    const healthData = {
      status: tables.success ? 'success' : 'error',
      message: `테이블 ${tables.count}개 조회 ${tables.success ? '성공' : '실패'}`,
      data: tables,
      timestamp: new Date().toISOString()
    };
    
    if (tables.success) {
      ResponseHelper.success(res, healthData);
    } else {
      ResponseHelper.databaseError(res, healthData.message, healthData);
    }
  } catch (error) {
    ResponseHelper.internalServerError(
      res,
      '테이블 목록 조회 중 오류가 발생했습니다.',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    );
  }
});

/**
 * GET /health/database/performance
 * 성능 테스트
 */
router.get('/database/performance', async (req, res) => {
  try {
    const performance = await connectionChecker.performanceTest();
    
    const healthData = {
      status: performance.status,
      message: `성능 테스트 ${performance.success ? '성공' : '실패'}`,
      responseTime: `${performance.responseTime}ms`,
      data: performance,
      timestamp: new Date().toISOString()
    };
    
    if (performance.success) {
      ResponseHelper.success(res, healthData);
    } else {
      ResponseHelper.databaseError(res, healthData.message, healthData);
    }
  } catch (error) {
    ResponseHelper.internalServerError(
      res,
      '성능 테스트 중 오류가 발생했습니다.',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    );
  }
});

export default router; 