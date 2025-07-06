import { PrismaClient } from '@prisma/client';
import passport from 'passport';
import { KakaoPassportStrategy } from './kakao.strategy';

const prisma = new PrismaClient();

export function initializePassport() {
  // 사용자 직렬화
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // 사용자 역직렬화
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });
      
      // Prisma 결과를 Express User 타입으로 변환
      if (user) {
        const passportUser = {
          id: user.id,
          email: user.email || undefined,
          name: user.name || undefined,
          provider: user.provider || undefined,
          profileImage: user.profileImage || undefined,
          preferredTime: user.preferredTime,
          language: user.language,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };
        done(null, passportUser);
      } else {
        done(null, null);
      }
    } catch (error) {
      done(error, null);
    }
  });

  // 카카오 전략 등록
  const kakaoStrategy = new KakaoPassportStrategy();
  passport.use(kakaoStrategy.name, kakaoStrategy.strategy);
} 