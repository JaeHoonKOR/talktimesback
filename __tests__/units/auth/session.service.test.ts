import { PrismaClient } from '@prisma/client';
import UAParser from 'ua-parser-js';
import { SessionService } from '../../../src/services/auth/session.service';

describe('SessionService', () => {
  let sessionService: SessionService;
  let prisma: PrismaClient;

  const mockUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  const mockIp = '127.0.0.1';

  beforeEach(() => {
    prisma = new PrismaClient();
    sessionService = new SessionService(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      // Arrange
      const userId = '123';

      // Act
      const session = await sessionService.createSession(userId, mockUserAgent, mockIp);

      // Assert
      expect(session).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.isActive).toBe(true);
      expect(session.lastActiveAt).toBeValidDate();
      
      const parser = new UAParser(mockUserAgent);
      const userAgent = parser.getResult();
      
      expect(session.deviceInfo).toEqual(expect.objectContaining({
        browser: userAgent.browser.name,
        os: userAgent.os.name,
        device: userAgent.device.type || 'desktop'
      }));
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      // Arrange
      const userId = '123';
      await sessionService.createSession(userId, mockUserAgent, mockIp);
      await sessionService.createSession(userId, mockUserAgent, '127.0.0.2');

      // Act
      const sessions = await sessionService.getActiveSessions(userId);

      // Assert
      expect(sessions).toHaveLength(2);
      sessions.forEach(session => {
        expect(session.userId).toBe(userId);
        expect(session.isActive).toBe(true);
      });
    });
  });

  describe('deactivateSession', () => {
    it('should deactivate a specific session', async () => {
      // Arrange
      const userId = '123';
      const session = await sessionService.createSession(userId, mockUserAgent, mockIp);

      // Act
      await sessionService.deactivateSession(session.id);

      // Assert
      const updatedSession = await prisma.activeSession.findUnique({
        where: { id: session.id }
      });
      expect(updatedSession?.isActive).toBe(false);
    });
  });

  describe('deactivateAllSessions', () => {
    it('should deactivate all sessions for user', async () => {
      // Arrange
      const userId = '123';
      await sessionService.createSession(userId, mockUserAgent, mockIp);
      await sessionService.createSession(userId, mockUserAgent, '127.0.0.2');

      // Act
      await sessionService.deactivateAllSessions(userId);

      // Assert
      const sessions = await prisma.activeSession.findMany({
        where: { userId }
      });
      sessions.forEach(session => {
        expect(session.isActive).toBe(false);
      });
    });
  });

  describe('updateSessionActivity', () => {
    it('should update session last active time', async () => {
      // Arrange
      const userId = '123';
      const session = await sessionService.createSession(userId, mockUserAgent, mockIp);
      const originalLastActiveAt = session.lastActiveAt;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Act
      await sessionService.updateSessionActivity(session.id);

      // Assert
      const updatedSession = await prisma.activeSession.findUnique({
        where: { id: session.id }
      });
      expect(updatedSession?.lastActiveAt.getTime()).toBeGreaterThan(originalLastActiveAt.getTime());
    });
  });

  describe('cleanupInactiveSessions', () => {
    it('should remove inactive sessions older than threshold', async () => {
      // Arrange
      const userId = '123';
      const session = await sessionService.createSession(userId, mockUserAgent, mockIp);
      
      // Deactivate session and modify lastActiveAt to be old
      await prisma.activeSession.update({
        where: { id: session.id },
        data: {
          isActive: false,
          lastActiveAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days old
        }
      });

      // Act
      await sessionService.cleanupInactiveSessions();

      // Assert
      const oldSession = await prisma.activeSession.findUnique({
        where: { id: session.id }
      });
      expect(oldSession).toBeNull();
    });
  });
}); 