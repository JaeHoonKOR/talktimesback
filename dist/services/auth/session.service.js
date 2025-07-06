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
exports.SessionService = void 0;
const client_1 = require("@prisma/client");
const ua_parser_js_1 = __importDefault(require("ua-parser-js"));
const uuid_1 = require("uuid");
const prisma = new client_1.PrismaClient();
/**
 * 세션 관리 서비스 - 사용자 세션 생성, 관리, 추적
 */
class SessionService {
    /**
     * 새 세션 생성
     */
    createSession(userId, req) {
        return __awaiter(this, void 0, void 0, function* () {
            const sessionId = (0, uuid_1.v4)();
            const ipAddress = this.getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            // 기기 정보 파싱
            const deviceInfo = this.parseDeviceInfo(userAgent);
            // 세션 만료 시간 설정 (기본 24시간)
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            // 활성 세션 생성
            yield prisma.activeSession.create({
                data: {
                    sessionId,
                    userId,
                    ipAddress,
                    userAgent,
                    deviceInfo,
                    expiresAt
                }
            });
            return sessionId;
        });
    }
    /**
     * 세션 활성화 상태 확인
     */
    isSessionActive(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield prisma.activeSession.findFirst({
                where: {
                    sessionId,
                    isActive: true,
                    expiresAt: {
                        gt: new Date()
                    }
                }
            });
            return !!session;
        });
    }
    /**
     * 세션 활동 업데이트
     */
    updateSessionActivity(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield prisma.activeSession.updateMany({
                where: {
                    sessionId,
                    isActive: true
                },
                data: {
                    lastActivity: new Date()
                }
            });
            return result.count > 0;
        });
    }
    /**
     * 세션 종료
     */
    terminateSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield prisma.activeSession.updateMany({
                where: {
                    sessionId,
                    isActive: true
                },
                data: {
                    isActive: false
                }
            });
            return result.count > 0;
        });
    }
    /**
     * 사용자의 모든 세션 종료 (현재 세션 제외)
     */
    terminateOtherSessions(userId, currentSessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield prisma.activeSession.updateMany({
                where: {
                    userId,
                    isActive: true,
                    NOT: {
                        sessionId: currentSessionId
                    }
                },
                data: {
                    isActive: false
                }
            });
            return result.count;
        });
    }
    /**
     * 사용자의 모든 활성 세션 조회
     */
    getUserActiveSessions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sessions = yield prisma.activeSession.findMany({
                where: {
                    userId,
                    isActive: true,
                    expiresAt: {
                        gt: new Date()
                    }
                },
                orderBy: {
                    lastActivity: 'desc'
                }
            });
            return sessions.map(session => ({
                sessionId: session.sessionId,
                deviceInfo: session.deviceInfo,
                ipAddress: session.ipAddress,
                lastActivity: session.lastActivity,
                createdAt: session.createdAt
            }));
        });
    }
    /**
     * 만료된 세션 정리
     */
    cleanupExpiredSessions() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield prisma.activeSession.updateMany({
                where: {
                    expiresAt: {
                        lt: new Date()
                    },
                    isActive: true
                },
                data: {
                    isActive: false
                }
            });
            return result.count;
        });
    }
    /**
     * 클라이언트 IP 주소 추출
     */
    getClientIp(req) {
        const forwardedFor = req.headers['x-forwarded-for'];
        if (forwardedFor) {
            return Array.isArray(forwardedFor)
                ? forwardedFor[0]
                : forwardedFor.split(',')[0].trim();
        }
        return req.socket.remoteAddress || '';
    }
    /**
     * 사용자 에이전트 파싱하여 기기 정보 추출
     */
    parseDeviceInfo(userAgent) {
        try {
            const parser = new ua_parser_js_1.default(userAgent);
            const result = parser.getResult();
            return {
                browser: result.browser.name || 'Unknown',
                browserVersion: result.browser.version || 'Unknown',
                os: result.os.name || 'Unknown',
                osVersion: result.os.version || 'Unknown',
                device: result.device.type || 'desktop',
                deviceModel: result.device.model || 'Unknown'
            };
        }
        catch (error) {
            console.error('User agent parsing error:', error);
            return {
                browser: 'Unknown',
                browserVersion: 'Unknown',
                os: 'Unknown',
                osVersion: 'Unknown',
                device: 'desktop',
                deviceModel: 'Unknown'
            };
        }
    }
}
exports.SessionService = SessionService;
exports.default = new SessionService();
