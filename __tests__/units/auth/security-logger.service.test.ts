import { PrismaClient } from '@prisma/client';
import { SecurityLoggerService } from '../../../src/services/auth/security-logger.service';
import { SecurityEventSeverity, SecurityEventType } from '../../../src/types/auth.types';

describe('SecurityLoggerService', () => {
  let securityLogger: SecurityLoggerService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    securityLogger = new SecurityLoggerService();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('logSecurityEvent', () => {
    it('should log authentication success event', async () => {
      // Arrange
      const userId = '123';
      const eventData = {
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        location: 'Seoul, KR'
      };

      // Act
      const event = await securityLogger.logSecurityEvent(
        SecurityEventType.AUTHENTICATION_SUCCESS,
        SecurityEventSeverity.INFO,
        userId,
        eventData
      );

      // Assert
      expect(event).toBeDefined();
      expect(event.type).toBe(SecurityEventType.AUTHENTICATION_SUCCESS);
      expect(event.severity).toBe(SecurityEventSeverity.INFO);
      expect(event.userId).toBe(userId);
      expect(event.eventData).toEqual(eventData);
      expect(event.timestamp).toBeValidDate();
    });

    it('should log authentication failure event', async () => {
      // Arrange
      const eventData = {
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        location: 'Seoul, KR',
        failureReason: 'Invalid password'
      };

      // Act
      const event = await securityLogger.logSecurityEvent(
        SecurityEventType.AUTHENTICATION_FAILED,
        SecurityEventSeverity.WARNING,
        null,
        eventData
      );

      // Assert
      expect(event).toBeDefined();
      expect(event.type).toBe(SecurityEventType.AUTHENTICATION_FAILED);
      expect(event.severity).toBe(SecurityEventSeverity.WARNING);
      expect(event.eventData).toEqual(eventData);
    });

    it('should log suspicious activity event', async () => {
      // Arrange
      const userId = '123';
      const eventData = {
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        location: 'Seoul, KR',
        activityType: 'Multiple failed login attempts'
      };

      // Act
      const event = await securityLogger.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        SecurityEventSeverity.CRITICAL,
        userId,
        eventData
      );

      // Assert
      expect(event).toBeDefined();
      expect(event.type).toBe(SecurityEventType.SUSPICIOUS_ACTIVITY);
      expect(event.severity).toBe(SecurityEventSeverity.CRITICAL);
      expect(event.userId).toBe(userId);
      expect(event.eventData).toEqual(eventData);
    });
  });

  describe('getSecurityEvents', () => {
    it('should return security events for user', async () => {
      // Arrange
      const userId = '123';
      await securityLogger.logSecurityEvent(
        SecurityEventType.AUTHENTICATION_SUCCESS,
        SecurityEventSeverity.INFO,
        userId,
        { ip: '127.0.0.1' }
      );
      await securityLogger.logSecurityEvent(
        SecurityEventType.PASSWORD_CHANGED,
        SecurityEventSeverity.INFO,
        userId,
        { ip: '127.0.0.1' }
      );

      // Act
      const events = await securityLogger.getSecurityEvents(userId);

      // Assert
      expect(events).toHaveLength(2);
      events.forEach(event => {
        expect(event.userId).toBe(userId);
      });
    });

    it('should return filtered security events by type', async () => {
      // Arrange
      const userId = '123';
      await securityLogger.logSecurityEvent(
        SecurityEventType.AUTHENTICATION_SUCCESS,
        SecurityEventSeverity.INFO,
        userId,
        { ip: '127.0.0.1' }
      );
      await securityLogger.logSecurityEvent(
        SecurityEventType.AUTHENTICATION_FAILED,
        SecurityEventSeverity.WARNING,
        userId,
        { ip: '127.0.0.1' }
      );

      // Act
      const events = await securityLogger.getSecurityEvents(userId, {
        type: SecurityEventType.AUTHENTICATION_FAILED
      });

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(SecurityEventType.AUTHENTICATION_FAILED);
    });

    it('should return filtered security events by severity', async () => {
      // Arrange
      const userId = '123';
      await securityLogger.logSecurityEvent(
        SecurityEventType.AUTHENTICATION_SUCCESS,
        SecurityEventSeverity.INFO,
        userId,
        { ip: '127.0.0.1' }
      );
      await securityLogger.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        SecurityEventSeverity.CRITICAL,
        userId,
        { ip: '127.0.0.1' }
      );

      // Act
      const events = await securityLogger.getSecurityEvents(userId, {
        severity: SecurityEventSeverity.CRITICAL
      });

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0].severity).toBe(SecurityEventSeverity.CRITICAL);
    });
  });

  describe('cleanupOldEvents', () => {
    it('should remove events older than retention period', async () => {
      // Arrange
      const userId = '123';
      const oldEvent = await prisma.authEventLog.create({
        data: {
          type: SecurityEventType.AUTHENTICATION_SUCCESS,
          severity: SecurityEventSeverity.INFO,
          userId,
          eventData: { ip: '127.0.0.1' },
          timestamp: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000) // 366 days old
        }
      });

      // Act
      await securityLogger.cleanupOldEvents();

      // Assert
      const event = await prisma.authEventLog.findUnique({
        where: { id: oldEvent.id }
      });
      expect(event).toBeNull();
    });
  });
}); 