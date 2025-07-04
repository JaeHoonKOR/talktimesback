import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { detectLocationMiddleware } from './middlewares/location.middleware';
import healthRoutes from './routes/health.routes';
import kakaoRoutes from './routes/kakao.routes';
import newsRoutes from './routes/news.routes';
import translationRoutes from './routes/translation.routes';
import { setupNewsCronJobs } from './services/news/news-cron';
import { ConnectionEvent, dbManager } from './utils/database-manager';
import { AppError, ErrorType, globalErrorHandler } from './utils/error-handler';
import { dbLogger, serverLogger } from './utils/logger';

// 환경 변수 로드
dotenv.config();

// VERBOSE_LOGGING 환경 변수 설정 (기본값: false)
if (process.env.VERBOSE_LOGGING === undefined) {
  process.env.VERBOSE_LOGGING = 'false';
}

// 이전 Prisma 클라이언트를 전역으로 익스포트 (호환성 유지)
export const prisma = dbManager.prisma;

// 앱 인스턴스 생성
const app = express();
const PORT = process.env.PORT || 4000;

// 미들웨어 설정
app.use(helmet()); // 보안 관련 HTTP 헤더 설정
app.use(cors()); // CORS 허용
app.use(express.json()); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL 인코딩된 데이터 파싱
app.use(detectLocationMiddleware);   // 사용자의 언어를 req.userLanguage 에 주입

// 개발 환경에서만 로깅 미들웨어 사용
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev')); // 로깅
}

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  // 헬스체크는 로깅 제외
  if (req.path === '/health' || req.path === '/health/db') {
    return next();
  }
  
  const startTime = Date.now();
  
  serverLogger.debug(`요청 시작: ${req.method} ${req.originalUrl}`, {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    query: req.query,
    body: req.body
  });
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'debug';
    
    serverLogger[level](`응답 완료: ${req.method} ${req.originalUrl} [${res.statusCode}] ${duration}ms`, {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      ip: req.ip
    });
  });
  
  next();
});

// 기본 라우트
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'JikSend API 서버가 정상적으로 실행 중입니다.',
  });
});

// 데이터베이스 연결 상태 확인 라우트
app.get('/health/db', async (req, res, next) => {
  try {
    const isConnected = await dbManager.checkConnection();
    
    if (isConnected) {
      res.status(200).json({
        status: 'healthy',
        message: 'Supabase 데이터베이스 연결이 정상입니다.',
        timestamp: new Date().toISOString()
      });
    } else {
      throw new AppError(
        ErrorType.DATABASE,
        'Supabase 데이터베이스 연결에 실패했습니다.',
        true,
        true
      );
    }
  } catch (error) {
    next(error);
  }
});

// 라우터 등록
app.use('/health', healthRoutes);
app.use('/api/kakao', kakaoRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/translation', translationRoutes);

// 404 오류 처리
app.use((req, res, next) => {
  next(new AppError(
    ErrorType.NOT_FOUND,
    `요청한 경로를 찾을 수 없습니다: ${req.originalUrl}`,
    true,
    false,
    null,
    { path: req.originalUrl, method: req.method }
  ));
});

// 글로벌 오류 처리 미들웨어 (반드시 모든 라우터 이후에 등록)
app.use(globalErrorHandler);

// 서버 시작 함수
async function startServer() {
  try {
    // 데이터베이스 연결 이벤트 리스너 설정
    dbManager.on(ConnectionEvent.CONNECTED, () => {
      dbLogger.info('Supabase 데이터베이스 연결 성공');
    });
    
    dbManager.on(ConnectionEvent.DISCONNECTED, (error) => {
      dbLogger.error('Supabase 데이터베이스 연결 끊김', error instanceof Error ? error : new Error(String(error)));
      dbLogger.info('자동 재연결 시도 중...');
    });
    
    dbManager.on(ConnectionEvent.RECONNECTED, () => {
      dbLogger.info('Supabase 데이터베이스 재연결 성공');
    });
    
    dbManager.on(ConnectionEvent.FAILED, (error) => {
      dbLogger.error('Supabase 데이터베이스 연결 실패', error instanceof Error ? error : new Error(String(error)), {
        limitedFeatures: [
          '번역 캐싱 (인메모리 번역만 가능)',
          '뉴스 수집 및 관리',
          '사용자 인증 관련 기능'
        ]
      });
    });
    
    // 데이터베이스 연결 초기화
    const isConnected = await dbManager.initialize();
    
    // Google Translate API 키 확인
    if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
      serverLogger.warn('Google Translate API 키가 설정되지 않았습니다. 번역 기능이 제한됩니다.');
    }
    
    // 뉴스 관련 cron 작업 설정
    setupNewsCronJobs();
    
    // 서버 시작
    const server = app.listen(PORT, () => {
      serverLogger.info(`서버 시작 완료 (포트: ${PORT}, 환경: ${process.env.NODE_ENV || 'development'})`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        verboseLogging: process.env.VERBOSE_LOGGING === 'true'
      });
    });

    // 프로세스 종료 시 리소스 정리
    process.on('SIGINT', async () => {
      serverLogger.info('서버 종료 신호를 받았습니다...');
      server.close(async () => {
        serverLogger.info('서버가 정상적으로 종료되었습니다.');
        try {
          await dbManager.disconnect();
          dbLogger.info('데이터베이스 연결이 종료되었습니다.');
        } catch (error) {
          dbLogger.error('데이터베이스 연결 종료 중 오류', error instanceof Error ? error : new Error(String(error)));
        }
        process.exit(0);
      });
    });

    // 예기치 않은 오류 처리
    process.on('uncaughtException', async (error) => {
      serverLogger.fatal('예기치 않은 오류 발생', error);
      try {
        await dbManager.disconnect();
      } catch (disconnectError) {
        dbLogger.error('데이터베이스 연결 종료 중 오류', disconnectError instanceof Error ? disconnectError : new Error(String(disconnectError)));
      }
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      serverLogger.fatal('처리되지 않은 Promise 거부', reason instanceof Error ? reason : new Error(String(reason)), { promise });
      try {
        await dbManager.disconnect();
      } catch (disconnectError) {
        dbLogger.error('데이터베이스 연결 종료 중 오류', disconnectError instanceof Error ? disconnectError : new Error(String(disconnectError)));
      }
      process.exit(1);
    });

    return server;
  } catch (error) {
    serverLogger.fatal('서버 시작 실패', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// 서버 시작
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app; 