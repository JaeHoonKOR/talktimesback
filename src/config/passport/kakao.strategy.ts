import { PrismaClient } from '@prisma/client';
import { Strategy as KakaoStrategy } from 'passport-kakao';
import { PassportStrategy } from './passport.interface';

const prisma = new PrismaClient();

export class KakaoPassportStrategy implements PassportStrategy {
  public name = 'kakao';

  public strategy = new KakaoStrategy(
    {
      clientID: process.env.KAKAO_CLIENT_ID || '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
      callbackURL: process.env.KAKAO_CALLBACK_URL || '',
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const existingUser = await prisma.user.findUnique({
          where: {
            kakaoId: profile.id,
          },
        });

        if (existingUser) {
          return done(null, existingUser);
        }

        // 새로운 사용자 생성
        const newUser = await prisma.user.create({
          data: {
            email: profile._json?.kakao_account?.email,
            name: profile.displayName,
            kakaoId: profile.id,
            provider: 'kakao',
          },
        });

        return done(null, newUser);
      } catch (error) {
        console.error('Kakao authentication error:', error);
        return done(error, false);
      }
    }
  );
} 