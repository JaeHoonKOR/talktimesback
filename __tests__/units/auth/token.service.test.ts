import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { TokenService } from '../../../src/services/auth/token.service';

describe('TokenService', () => {
  let tokenService: TokenService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    tokenService = new TokenService();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', async () => {
      // Arrange
      const userId = '123';
      const email = 'test@example.com';
      const sessionId = '456';

      // Act
      const token = await tokenService.generateAccessToken(userId, email, sessionId);

      // Assert
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.sessionId).toBe(sessionId);
      expect(decoded.type).toBe('access');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token and store it', async () => {
      // Arrange
      const userId = '123';
      const sessionId = '456';

      // Act
      const token = await tokenService.generateRefreshToken(userId, sessionId);

      // Assert
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe(userId);
      expect(decoded.sessionId).toBe(sessionId);
      expect(decoded.type).toBe('refresh');

      // Verify token is stored in database
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          userId,
          sessionId
        }
      });
      expect(storedToken).toBeDefined();
      expect(storedToken!.isRevoked).toBe(false);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      // Arrange
      const userId = '123';
      const email = 'test@example.com';
      const sessionId = '456';
      const token = await tokenService.generateAccessToken(userId, email, sessionId);

      // Act
      const result = await tokenService.verifyToken(token);

      // Assert
      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.email).toBe(email);
      expect(result.sessionId).toBe(sessionId);
    });

    it('should throw error for invalid token', async () => {
      // Arrange
      const invalidToken = 'invalid.token.here';

      // Act & Assert
      await expect(tokenService.verifyToken(invalidToken))
        .rejects
        .toThrow('Invalid token');
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist a token', async () => {
      // Arrange
      const userId = '123';
      const email = 'test@example.com';
      const sessionId = '456';
      const token = await tokenService.generateAccessToken(userId, email, sessionId);

      // Act
      await tokenService.blacklistToken(token);

      // Assert
      const isBlacklisted = await tokenService.isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      // Arrange
      const userId = '123';
      const email = 'test@example.com';
      const sessionId = '456';
      const token = await tokenService.generateAccessToken(userId, email, sessionId);
      await tokenService.blacklistToken(token);

      // Act
      const result = await tokenService.isTokenBlacklisted(token);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      // Arrange
      const userId = '123';
      const email = 'test@example.com';
      const sessionId = '456';
      const token = await tokenService.generateAccessToken(userId, email, sessionId);

      // Act
      const result = await tokenService.isTokenBlacklisted(token);

      // Assert
      expect(result).toBe(false);
    });
  });
}); 