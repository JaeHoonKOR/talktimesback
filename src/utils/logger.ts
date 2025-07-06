import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// 로그 수준 정의
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// 로그 카테고리 정의
export enum LogCategory {
  DATABASE = 'database',
  SERVER = 'server',
  TRANSLATION = 'translation',
  NEWS = 'news',
  AUTHENTICATION = 'auth',
  EXTERNAL_API = 'external',
  CRON = 'cron',
  GENERAL = 'general'
}

// 로그 엔트리 인터페이스
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  category: LogCategory;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

// 개발 환경용 콘솔 포맷 설정
const developmentFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.colorize(),
  winston.format.printf(info => {
    const { timestamp, level, message, category, context, error } = info;
    
    let logString = `${timestamp} [${level}] [${category}]: ${message}`;
    
    if (context) {
      const contextStr = JSON.stringify(context, null, 0);
      if (contextStr !== '{}') {
        logString += ` | Context: ${contextStr}`;
      }
    }
    
    if (error) {
      const err = error as Error;
      logString += `\nError: ${err.message || 'Unknown error'}`;
      if (err.stack) {
        logString += `\nStack: ${err.stack}`;
      }
    }
    
    return logString;
  })
);

// 프로덕션 환경용 JSON 포맷 설정
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// 로그 파일 저장 경로
const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// 로거 인스턴스 생성
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { 
    service: 'jiksend-backend'
  },
  format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  transports: [
    // 콘솔 출력
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      handleExceptions: true
    })
  ]
});

// 프로덕션 환경에서는 파일 로깅 추가
if (process.env.NODE_ENV === 'production') {
  // 일반 로그용 Daily Rotate File 트랜스포트
  const fileTransport = new DailyRotateFile({
    filename: path.join(logDir, 'jiksend-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'info'
  });
  
  // 에러 로그용 Daily Rotate File 트랜스포트
  const errorFileTransport = new DailyRotateFile({
    filename: path.join(logDir, 'jiksend-error-%DATE%.log'),
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
export class Logger {
  private category: LogCategory;
  
  constructor(category: LogCategory = LogCategory.GENERAL) {
    this.category = category;
  }
  
  // 로그 수준별 메서드
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  public error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(
      LogLevel.ERROR, 
      message, 
      context, 
      error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    );
  }
  
  public fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(
      LogLevel.FATAL, 
      message, 
      context, 
      error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    );
  }
  
  // 내부 로그 메서드
  private log(
    level: LogLevel, 
    message: string, 
    context?: Record<string, unknown>,
    error?: {
      message: string;
      stack?: string;
      code?: string;
    }
  ): void {
    const logData: any = {
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

// 카테고리별 로거 인스턴스 생성
export const serverLogger = new Logger(LogCategory.SERVER);
export const dbLogger = new Logger(LogCategory.DATABASE);
export const translationLogger = new Logger(LogCategory.TRANSLATION);
export const newsLogger = new Logger(LogCategory.NEWS);
export const authLogger = new Logger(LogCategory.AUTHENTICATION);
export const externalApiLogger = new Logger(LogCategory.EXTERNAL_API);
export const cronLogger = new Logger(LogCategory.CRON);

// 기본 로거 익스포트
export default new Logger(LogCategory.GENERAL); 