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
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // 카카오 전략 등록
  const kakaoStrategy = new KakaoPassportStrategy();
  passport.use(kakaoStrategy.name, kakaoStrategy.strategy);
} 