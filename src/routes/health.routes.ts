import { Router } from 'express';
import { prisma } from '../server';
import { SupabaseConnectionChecker } from '../utils/database';

const router = Router();
const connectionChecker = new SupabaseConnectionChecker(prisma);

// 기본 헬스체크
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'JikSend API 서버가 정상적으로 실행 중입니다.',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 데이터베이스 연결 상태 확인
router.get('/db', async (req, res) => {
  try {
    const isConnected = await connectionChecker.isConnected();
    
    if (isConnected) {
      const info = await connectionChecker.getConnectionInfo();
      res.status(200).json({
        status: 'healthy',
        message: 'Supabase 데이터베이스 연결이 정상입니다.',
        database: info.info?.database_name,
        user: info.info?.user_name,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        status: 'unhealthy',
        message: 'Supabase 데이터베이스 연결에 실패했습니다.',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      message: 'Supabase 데이터베이스 연결 확인 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// 상세 데이터베이스 정보
router.get('/db/info', async (req, res) => {
  try {
    const info = await connectionChecker.getConnectionInfo();
    const tables = await connectionChecker.getTables();
    const performance = await connectionChecker.performanceTest();
    
    res.status(200).json({
      status: info.connected ? 'healthy' : 'unhealthy',
      connection: info,
      tables: tables,
      performance: performance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '데이터베이스 정보 조회 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// 종합 헬스체크
router.get('/full', async (req, res) => {
  try {
    const results = await connectionChecker.fullHealthCheck();
    
    const overallStatus = results.connection.connected && 
                         results.tables.success && 
                         results.performance.success ? 'healthy' : 'unhealthy';
    
    res.status(overallStatus === 'healthy' ? 200 : 500).json({
      status: overallStatus,
      message: `종합 헬스체크 ${overallStatus === 'healthy' ? '성공' : '실패'}`,
      results: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '종합 헬스체크 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// 테이블 목록 조회
router.get('/db/tables', async (req, res) => {
  try {
    const tables = await connectionChecker.getTables();
    
    res.status(200).json({
      status: tables.success ? 'success' : 'error',
      message: `테이블 ${tables.count}개 조회 ${tables.success ? '성공' : '실패'}`,
      data: tables,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '테이블 목록 조회 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// 성능 테스트
router.get('/db/performance', async (req, res) => {
  try {
    const performance = await connectionChecker.performanceTest();
    
    res.status(performance.success ? 200 : 500).json({
      status: performance.status,
      message: `성능 테스트 ${performance.success ? '성공' : '실패'}`,
      responseTime: `${performance.responseTime}ms`,
      data: performance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '성능 테스트 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 