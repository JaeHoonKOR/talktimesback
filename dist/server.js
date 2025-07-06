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
exports.prisma = void 0;
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const location_middleware_1 = require("./middlewares/location.middleware");
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const kakao_routes_1 = __importDefault(require("./routes/kakao.routes"));
const news_routes_1 = __importDefault(require("./routes/news.routes"));
const translation_routes_1 = __importDefault(require("./routes/translation.routes"));
// V2 API 라우터 (RESTful)
const auth_routes_v2_1 = __importDefault(require("./routes/auth.routes.v2"));
const news_routes_v2_1 = __importDefault(require("./routes/news.routes.v2"));
const translations_routes_v2_1 = __importDefault(require("./routes/translations.routes.v2"));
const users_routes_v2_1 = __importDefault(require("./routes/users.routes.v2"));
const news_cron_1 = require("./services/news/news-cron");
const database_manager_1 = require("./utils/database-manager");
const error_handler_1 = require("./utils/error-handler");
const env_validator_1 = require("./utils/env-validator");
const logger_1 = require("./utils/logger");
// 환경 변수 로드
dotenv_1.default.config();
// 환경 변수 검증 (서버 시작 전 필수)
(0, env_validator_1.validateEnvironmentVariables)();
// VERBOSE_LOGGING 환경 변수 설정 (기본값: false)
if (process.env.VERBOSE_LOGGING === undefined) {
    process.env.VERBOSE_LOGGING = 'false';
}
// 이전 Prisma 클라이언트를 전역으로 익스포트 (호환성 유지)
exports.prisma = database_manager_1.dbManager.prisma;
// 앱 인스턴스 생성
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// 미들웨어 설정
app.use((0, helmet_1.default)()); // 보안 관련 HTTP 헤더 설정
app.use((0, cors_1.default)()); // CORS 허용
app.use(express_1.default.json()); // JSON 파싱
app.use(express_1.default.urlencoded({ extended: true })); // URL 인코딩된 데이터 파싱
app.use(location_middleware_1.detectLocationMiddleware); // 사용자의 언어를 req.userLanguage 에 주입
// 개발 환경에서만 로깅 미들웨어 사용
if (process.env.NODE_ENV !== 'production') {
    app.use((0, morgan_1.default)('dev')); // 로깅
}
// 요청 로깅 미들웨어
app.use((req, res, next) => {
    // 헬스체크는 로깅 제외
    if (req.path === '/health' || req.path === '/health/db') {
        return next();
    }
    const startTime = Date.now();
    // 민감한 정보 마스킹
    const sanitizedBody = req.body ? Object.keys(req.body).reduce((acc, key) => {
        acc[key] = (0, env_validator_1.maskSensitiveValue)(key, String(req.body[key]));
        return acc;
    }, {}) : {};
    logger_1.serverLogger.debug(`요청 시작: ${req.method} ${req.originalUrl}`, {
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        query: req.query,
        body: sanitizedBody
    });
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const level = res.statusCode >= 400 ? 'warn' : 'debug';
        logger_1.serverLogger[level](`응답 완료: ${req.method} ${req.originalUrl} [${res.statusCode}] ${duration}ms`, {
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
app.get('/health/db', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const isConnected = yield database_manager_1.dbManager.checkConnection();
        if (isConnected) {
            res.status(200).json({
                status: 'healthy',
                message: 'Supabase 데이터베이스 연결이 정상입니다.',
                timestamp: new Date().toISOString()
            });
        }
        else {
            throw new error_handler_1.AppError(error_handler_1.ErrorType.DATABASE, 'Supabase 데이터베이스 연결에 실패했습니다.', true, true);
        }
    }
    catch (error) {
        next(error);
    }
}));
// 라우터 등록
app.use('/health', health_routes_1.default);
app.use('/api/kakao', kakao_routes_1.default);
app.use('/api/news', news_routes_1.default);
app.use('/api/translation', translation_routes_1.default);
// V2 API 라우터 연결 (RESTful)
app.use('/api/v2/auth', auth_routes_v2_1.default);
app.use('/api/v2/news', news_routes_v2_1.default);
app.use('/api/v2/translations', translations_routes_v2_1.default);
app.use('/api/v2/users', users_routes_v2_1.default);
// Swagger UI 라우트 (개발 환경에서만)
if (process.env.NODE_ENV !== 'production') {
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'JikSend API Documentation',
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
        },
    }));
    // Swagger JSON 스펙 제공
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swagger_1.swaggerSpec);
    });
}
// 404 오류 처리
app.use((req, res, next) => {
    next(new error_handler_1.AppError(error_handler_1.ErrorType.NOT_FOUND, `요청한 경로를 찾을 수 없습니다: ${req.originalUrl}`, true, false, null, { path: req.originalUrl, method: req.method }));
});
// 글로벌 오류 처리 미들웨어 (반드시 모든 라우터 이후에 등록)
app.use(error_handler_1.globalErrorHandler);
// 서버 시작 함수
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 데이터베이스 연결 이벤트 리스너 설정
            database_manager_1.dbManager.on(database_manager_1.ConnectionEvent.CONNECTED, () => {
                logger_1.dbLogger.info('Supabase 데이터베이스 연결 성공');
            });
            database_manager_1.dbManager.on(database_manager_1.ConnectionEvent.DISCONNECTED, (error) => {
                logger_1.dbLogger.error('Supabase 데이터베이스 연결 끊김', error instanceof Error ? error : new Error(String(error)));
                logger_1.dbLogger.info('자동 재연결 시도 중...');
            });
            database_manager_1.dbManager.on(database_manager_1.ConnectionEvent.RECONNECTED, () => {
                logger_1.dbLogger.info('Supabase 데이터베이스 재연결 성공');
            });
            database_manager_1.dbManager.on(database_manager_1.ConnectionEvent.FAILED, (error) => {
                logger_1.dbLogger.error('Supabase 데이터베이스 연결 실패', error instanceof Error ? error : new Error(String(error)), {
                    limitedFeatures: [
                        '번역 캐싱 (인메모리 번역만 가능)',
                        '뉴스 수집 및 관리',
                        '사용자 인증 관련 기능'
                    ]
                });
            });
            // 데이터베이스 연결 초기화
            const isConnected = yield database_manager_1.dbManager.initialize();
            // Google Translate API 키 확인
            if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
                logger_1.serverLogger.warn('Google Translate API 키가 설정되지 않았습니다. 번역 기능이 제한됩니다.');
            }
            // 뉴스 관련 cron 작업 설정
            (0, news_cron_1.setupNewsCronJobs)();
            // 서버 시작
            const server = app.listen(PORT, () => {
                logger_1.serverLogger.info(`서버 시작 완료 (포트: ${PORT}, 환경: ${process.env.NODE_ENV || 'development'})`, {
                    port: PORT,
                    environment: process.env.NODE_ENV || 'development',
                    verboseLogging: process.env.VERBOSE_LOGGING === 'true'
                });
            });
            // 프로세스 종료 시 리소스 정리
            process.on('SIGINT', () => __awaiter(this, void 0, void 0, function* () {
                logger_1.serverLogger.info('서버 종료 신호를 받았습니다...');
                server.close(() => __awaiter(this, void 0, void 0, function* () {
                    logger_1.serverLogger.info('서버가 정상적으로 종료되었습니다.');
                    try {
                        yield database_manager_1.dbManager.disconnect();
                        logger_1.dbLogger.info('데이터베이스 연결이 종료되었습니다.');
                    }
                    catch (error) {
                        logger_1.dbLogger.error('데이터베이스 연결 종료 중 오류', error instanceof Error ? error : new Error(String(error)));
                    }
                    process.exit(0);
                }));
            }));
            // 예기치 않은 오류 처리
            process.on('uncaughtException', (error) => __awaiter(this, void 0, void 0, function* () {
                logger_1.serverLogger.fatal('예기치 않은 오류 발생', error);
                try {
                    yield database_manager_1.dbManager.disconnect();
                }
                catch (disconnectError) {
                    logger_1.dbLogger.error('데이터베이스 연결 종료 중 오류', disconnectError instanceof Error ? disconnectError : new Error(String(disconnectError)));
                }
                process.exit(1);
            }));
            process.on('unhandledRejection', (reason, promise) => __awaiter(this, void 0, void 0, function* () {
                logger_1.serverLogger.fatal('처리되지 않은 Promise 거부', reason instanceof Error ? reason : new Error(String(reason)), { promise });
                try {
                    yield database_manager_1.dbManager.disconnect();
                }
                catch (disconnectError) {
                    logger_1.dbLogger.error('데이터베이스 연결 종료 중 오류', disconnectError instanceof Error ? disconnectError : new Error(String(disconnectError)));
                }
                process.exit(1);
            }));
            return server;
        }
        catch (error) {
            logger_1.serverLogger.fatal('서버 시작 실패', error instanceof Error ? error : new Error(String(error)));
            process.exit(1);
        }
    });
}
// 서버 시작
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
exports.default = app;
