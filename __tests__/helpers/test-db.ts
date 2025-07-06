import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
  }
  return prisma;
}

export async function clearTestDatabase() {
  const prisma = getTestPrisma();
  
  // 테이블 정리 순서 중요 (외래 키 제약 조건 고려)
  await prisma.tokenBlacklist.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.authEventLog.deleteMany();
  await prisma.activeSession.deleteMany();
  await prisma.userSecuritySettings.deleteMany();
}

export async function setupTestDatabase() {
  const prisma = getTestPrisma();
  await clearTestDatabase();
}

export async function teardownTestDatabase() {
  if (prisma) {
    await clearTestDatabase();
    await prisma.$disconnect();
  }
} 