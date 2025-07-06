"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronLogger = exports.externalApiLogger = exports.authLogger = exports.newsLogger = exports.translationLogger = exports.dbLogger = exports.serverLogger = exports.Logger = exports.LogCategory = exports.LogLevel = void 0;
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
// 로그 수준 정의
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
    LogLevel["FATAL"] = "fatal";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
// 로그 카테고리 정의
var LogCategory;
(function (LogCategory) {
    LogCategory["DATABASE"] = "database";
    LogCategory["SERVER"] = "server";
    LogCategory["TRANSLATION"] = "translation";
    LogCategory["NEWS"] = "news";
    LogCategory["AUTHENTICATION"] = "auth";
    LogCategory["EXTERNAL_API"] = "external";
    LogCategory["CRON"] = "cron";
    LogCategory["GENERAL"] = "general";
})(LogCategory || (exports.LogCategory = LogCategory = {}));
// 개발 환경용 콘솔 포맷 설정
const developmentFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
}), winston_1.default.format.colorize(), winston_1.default.format.printf(info => {
    const { timestamp, level, message, category, context, error } = info;
    let logString = `${timestamp} [${level}] [${category}]: ${message}`;
    if (context) {
        const contextStr = JSON.stringify(context, null, 0);
        if (contextStr !== '{}') {
            logString += ` | Context: ${contextStr}`;
        }
    }
    if (error) {
        const err = error;
        logString += `\nError: ${err.message || 'Unknown error'}`;
        if (err.stack) {
            logString += `\nStack: ${err.stack}`;
        }
    }
    return logString;
}));
// 프로덕션 환경용 JSON 포맷 설정
const productionFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json());
// 로그 파일 저장 경로
const logDir = process.env.LOG_DIR || path_1.default.join(process.cwd(), 'logs');
// 로거 인스턴스 생성
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: {
        service: 'jiksend-backend'
    },
    format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
    transports: [
        // 콘솔 출력
        new winston_1.default.transports.Console({
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            handleExceptions: true
        })
    ]
});
// 프로덕션 환경에서는 파일 로깅 추가
if (process.env.NODE_ENV === 'production') {
    // 일반 로그용 Daily Rotate File 트랜스포트
    const fileTransport = new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logDir, 'jiksend-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info'
    });
    // 에러 로그용 Daily Rotate File 트랜스포트
    const errorFileTransport = new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logDir, 'jiksend-error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error'
    });
    logger.add(fileTransport);
    logger.add(errorFileTransport);
}
// 로그 함수 정의
class Logger {
    constructor(category = LogCategory.GENERAL) {
        this.category = category;
    }
    // 로그 수준별 메서드
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    error(message, error, context) {
        this.log(LogLevel.ERROR, message, context, error ? {
            message: error.message,
            stack: error.stack,
            code: error.code
        } : undefined);
    }
    fatal(message, error, context) {
        this.log(LogLevel.FATAL, message, context, error ? {
            message: error.message,
            stack: error.stack,
            code: error.code
        } : undefined);
    }
    // 내부 로그 메서드
    log(level, message, context, error) {
        const logData = {
            level,
            message,
            category: this.category,
            context,
            error
        };
        logger.log(logData);
        // 상세 로깅이 꺼져 있을 때 불필요한 로그 출력 방지
        if (process.env.VERBOSE_LOGGING !== 'true' && level === LogLevel.DEBUG) {
            return;
        }
    }
}
exports.Logger = Logger;
// 카테고리별 로거 인스턴스 생성
exports.serverLogger = new Logger(LogCategory.SERVER);
exports.dbLogger = new Logger(LogCategory.DATABASE);
exports.translationLogger = new Logger(LogCategory.TRANSLATION);
exports.newsLogger = new Logger(LogCategory.NEWS);
exports.authLogger = new Logger(LogCategory.AUTHENTICATION);
exports.externalApiLogger = new Logger(LogCategory.EXTERNAL_API);
exports.cronLogger = new Logger(LogCategory.CRON);
// 기본 로거 익스포트
exports.default = new Logger(LogCategory.GENERAL);
