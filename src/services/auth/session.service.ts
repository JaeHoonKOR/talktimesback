import { PrismaClient } from '@prisma/client';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * 세션 관리 서비스 - 사용자 세션 생성, 관리, 추적
 */
export class SessionService {
  /**
   * 새 세션 생성
   */
  async createSession(userId: string, req: Request): Promise<string> {
    const sessionId = uuidv4();
    const ipAddress = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    
    // 기기 정보 파싱
    const deviceInfo = this.parseDeviceInfo(userAgent);
    
    // 세션 만료 시간 설정 (기본 24시간)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 활성 세션 생성
    await prisma.activeSession.create({
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
  }

  /**
   * 세션 활성화 상태 확인
   */
  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await prisma.activeSession.findFirst({
      where: {
        sessionId,
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    return !!session;
  }

  /**
   * 세션 활동 업데이트
   */
  async updateSessionActivity(sessionId: string): Promise<boolean> {
    const result = await prisma.activeSession.updateMany({
      where: {
        sessionId,
        isActive: true
      },
      data: {
        lastActivity: new Date()
      }
    });

    return result.count > 0;
  }

  /**
   * 세션 종료
   */
  async terminateSession(sessionId: string): Promise<boolean> {
    const result = await prisma.activeSession.updateMany({
      where: {
        sessionId,
        isActive: true
      },
      data: {
        isActive: false
      }
    });

    return result.count > 0;
  }

  /**
   * 사용자의 모든 세션 종료 (현재 세션 제외)
   */
  async terminateOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const result = await prisma.activeSession.updateMany({
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
  }

  /**
   * 사용자의 모든 활성 세션 조회
   */
  async getUserActiveSessions(userId: string): Promise<any[]> {
    const sessions = await prisma.activeSession.findMany({
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
  }

  /**
   * 만료된 세션 정리
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.activeSession.updateMany({
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
  }

  /**
   * 클라이언트 IP 주소 추출
   */
  private getClientIp(req: Request): string {
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
  private parseDeviceInfo(userAgent: string): any {
    try {
      const parser = new UAParser(userAgent);
      const result = parser.getResult();
      
      return {
        browser: result.browser.name || 'Unknown',
        browserVersion: result.browser.version || 'Unknown',
        os: result.os.name || 'Unknown',
        osVersion: result.os.version || 'Unknown',
        device: result.device.type || 'desktop',
        deviceModel: result.device.model || 'Unknown'
      };
    } catch (error) {
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

export default new SessionService(); 