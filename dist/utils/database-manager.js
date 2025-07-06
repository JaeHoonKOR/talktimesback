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
exports.DatabaseManager = exports.dbManager = exports.DatabaseConnectionManager = exports.ConnectionEvent = void 0;
const client_1 = require("@prisma/client");
const events_1 = __importDefault(require("events"));
// 연결 상태 이벤트 타입
var ConnectionEvent;
(function (ConnectionEvent) {
    ConnectionEvent["CONNECTED"] = "connected";
    ConnectionEvent["DISCONNECTED"] = "disconnected";
    ConnectionEvent["RECONNECTED"] = "reconnected";
    ConnectionEvent["FAILED"] = "failed";
})(ConnectionEvent || (exports.ConnectionEvent = ConnectionEvent = {}));
/**
 * 데이터베이스 연결 관리자 클래스
 * 싱글톤 패턴을 사용하여 애플리케이션 전체에서 하나의 인스턴스만 존재하도록 함
 */
class DatabaseConnectionManager extends events_1.default {
    constructor() {
        super();
        this._isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectInterval = 5000; // ms
        this.reconnectTimeoutId = null;
        this._prisma = new client_1.PrismaClient({
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
    static getInstance() {
        if (!DatabaseConnectionManager.instance) {
            DatabaseConnectionManager.instance = new DatabaseConnectionManager();
        }
        return DatabaseConnectionManager.instance;
    }
    /**
     * Prisma 클라이언트 인스턴스 가져오기
     */
    get prisma() {
        return this._prisma;
    }
    /**
     * 현재 연결 상태 가져오기
     */
    get isConnected() {
        return this._isConnected;
    }
    /**
     * 데이터베이스 연결 초기화 및 확인
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.checkConnection();
                return this._isConnected;
            }
            catch (error) {
                console.error('데이터베이스 초기화 오류:', error);
                this._isConnected = false;
                this.emit(ConnectionEvent.FAILED, error);
                return false;
            }
        });
    }
    /**
     * 데이터베이스 연결 상태 확인
     */
    checkConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Prepared statement 문제 방지를 위해 executeRaw 사용
                yield this._prisma.$executeRaw `SELECT 1 AS connection_test`;
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
                    }
                    else {
                        this.emit(ConnectionEvent.CONNECTED);
                    }
                }
                return true;
            }
            catch (error) {
                // 연결 상태 변경 확인 및 이벤트 발생
                if (this._isConnected) {
                    this._isConnected = false;
                    this.emit(ConnectionEvent.DISCONNECTED, error);
                    this.scheduleReconnect();
                }
                return false;
            }
        });
    }
    /**
     * 연결 재시도 스케줄링
     */
    scheduleReconnect() {
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
        }
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`데이터베이스 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            this.reconnectTimeoutId = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                yield this.checkConnection();
            }), this.reconnectInterval);
        }
        else {
            console.error(`최대 재연결 시도 횟수(${this.maxReconnectAttempts})를 초과했습니다.`);
        }
    }
    /**
     * 리소스 정리 및 연결 종료
     */
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.reconnectTimeoutId) {
                    clearTimeout(this.reconnectTimeoutId);
                    this.reconnectTimeoutId = null;
                }
                yield this._prisma.$disconnect();
                this._isConnected = false;
                this.emit(ConnectionEvent.DISCONNECTED);
            }
            catch (error) {
                console.error('데이터베이스 연결 종료 오류:', error);
            }
        });
    }
    /**
     * SQL 쿼리 실행 메서드
     */
    executeQuery(query, params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Raw SQL 쿼리 실행
                const result = yield this._prisma.$queryRawUnsafe(query, ...(params || []));
                // 결과를 배열로 변환 (SELECT 쿼리의 경우)
                if (Array.isArray(result)) {
                    return {
                        rows: result,
                        rowCount: result.length
                    };
                }
                // INSERT, UPDATE, DELETE 등의 경우
                return {
                    rows: [],
                    rowCount: typeof result === 'number' ? result : 0
                };
            }
            catch (error) {
                console.error('SQL 쿼리 실행 오류:', error);
                throw error;
            }
        });
    }
}
exports.DatabaseConnectionManager = DatabaseConnectionManager;
// 싱글톤 인스턴스 익스포트
exports.dbManager = DatabaseConnectionManager.getInstance();
// 호환성을 위한 별칭 export
exports.DatabaseManager = DatabaseConnectionManager;
