import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { apiRateLimiter, authRateLimiter, newsRateLimiter, publicApiRateLimiter, translationRateLimiter } from './middlewares/rate-limit.middleware';
import { errorHandler } from './utils/error-handler';
import { serverLogger } from './utils/logger';

// 라우터 가져오기
import authRoutes from './routes/auth.routes';
import authRoutesV2 from './routes/auth.routes.v2';
import healthRoutes from './routes/health.routes';
import kakaoRoutes from './routes/kakao.routes';
import newsRoutes from './routes/news.routes';
import newsRoutesV2 from './routes/news.routes.v2';
import translationRoutes from './routes/translation.routes';
import translationsRoutesV2 from './routes/translations.routes.v2';
import usersRoutesV2 from './routes/users.routes.v2';

// Express 앱 생성
const app = express();

// 기본 미들웨어 설정
app.use(helmet());
app.use(cors());
app.use(compression()); // 응답 압축
app.use(express.json({ limit: '1mb' })); // 요청 본문 크기 제한
app.use(express.urlencoded({ extended: true }));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  const start = Date.now();
  
  // 응답이 완료되면 로그 기록
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    serverLogger[logLevel](`${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
    });
  });
  
  next();
});

// 헬스체크 라우터 (Rate Limiting 없음)
app.use('/health', healthRoutes);

// API 라우터 등록 (Rate Limiting 적용)
app.use('/api/translation', translationRateLimiter, translationRoutes);
app.use('/api/v2/translations', translationRateLimiter, translationsRoutesV2);
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/v2/auth', authRateLimiter, authRoutesV2);
app.use('/api/kakao', authRateLimiter, kakaoRoutes);
app.use('/api/news', newsRateLimiter, newsRoutes);
app.use('/api/v2/news', newsRateLimiter, newsRoutesV2);
app.use('/api/v2/users', apiRateLimiter, usersRoutesV2);

// 공개 API 라우터 (별도의 Rate Limiting 적용)
app.use('/public/api', publicApiRateLimiter);

// 기본 API 경로에 전역 Rate Limiting 적용
app.use('/api', apiRateLimiter);

// 404 처리
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: '요청하신 경로를 찾을 수 없습니다.',
    path: req.originalUrl
  });
});

// 에러 핸들러
app.use(errorHandler);

export default app; 