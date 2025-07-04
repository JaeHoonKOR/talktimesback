import { PrismaClient } from '@prisma/client';
import EventEmitter from 'events';

// 연결 상태 리스너 타입 정의
export type ConnectionListener = (isConnected: boolean) => void;

// 연결 상태 이벤트 타입
export enum ConnectionEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTED = 'reconnected',
  FAILED = 'failed'
}

/**
 * 데이터베이스 연결 관리자 클래스
 * 싱글톤 패턴을 사용하여 애플리케이션 전체에서 하나의 인스턴스만 존재하도록 함
 */
export class DatabaseConnectionManager extends EventEmitter {
  private static instance: DatabaseConnectionManager;
  private _isConnected: boolean = false;
  private _prisma: PrismaClient;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: number = 5000; // ms
  private reconnectTimeoutId: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this._prisma = new PrismaClient({
      log: ['warn', 'error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      }
    });
  }

  /**
   * 싱글톤 인스턴스 가져오기
   */
  public static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  /**
   * Prisma 클라이언트 인스턴스 가져오기
   */
  public get prisma(): PrismaClient {
    return this._prisma;
  }

  /**
   * 현재 연결 상태 가져오기
   */
  public get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * 데이터베이스 연결 초기화 및 확인
   */
  public async initialize(): Promise<boolean> {
    try {
      await this.checkConnection();
      return this._isConnected;
    } catch (error) {
      console.error('데이터베이스 초기화 오류:', error);
      this._isConnected = false;
      this.emit(ConnectionEvent.FAILED, error);
      return false;
    }
  }

  /**
   * 데이터베이스 연결 상태 확인
   */
  public async checkConnection(): Promise<boolean> {
    try {
      // Prepared statement 문제 방지를 위해 executeRaw 사용
      await this._prisma.$executeRaw`SELECT 1 AS connection_test`;
      
      // 연결 상태 변경 확인 및 이벤트 발생
      if (!this._isConnected) {
        this._isConnected = true;
        this.reconnectAttempts = 0;
        
        if (this.reconnectTimeoutId) {
          clearTimeout(this.reconnectTimeoutId);
          this.reconnectTimeoutId = null;
        }
        
        // 최초 연결인지 재연결인지 구분
        if (this.reconnectAttempts > 0) {
          this.emit(ConnectionEvent.RECONNECTED);
        } else {
          this.emit(ConnectionEvent.CONNECTED);
        }
      }
      
      return true;
    } catch (error) {
      // 연결 상태 변경 확인 및 이벤트 발생
      if (this._isConnected) {
        this._isConnected = false;
        this.emit(ConnectionEvent.DISCONNECTED, error);
        this.scheduleReconnect();
      }
      
      return false;
    }
  }

  /**
   * 연결 재시도 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      console.log(`데이터베이스 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      this.reconnectTimeoutId = setTimeout(async () => {
        await this.checkConnection();
      }, this.reconnectInterval);
    } else {
      console.error(`최대 재연결 시도 횟수(${this.maxReconnectAttempts})를 초과했습니다.`);
    }
  }

  /**
   * 리소스 정리 및 연결 종료
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
      }
      
      await this._prisma.$disconnect();
      this._isConnected = false;
      this.emit(ConnectionEvent.DISCONNECTED);
    } catch (error) {
      console.error('데이터베이스 연결 종료 오류:', error);
    }
  }
}

// 싱글톤 인스턴스 익스포트
export const dbManager = DatabaseConnectionManager.getInstance(); 