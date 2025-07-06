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
Object.defineProperty(exports, "__esModule", { value: true });
exports.KakaoPassportStrategy = void 0;
const client_1 = require("@prisma/client");
const passport_kakao_1 = require("passport-kakao");
const prisma = new client_1.PrismaClient();
class KakaoPassportStrategy {
    constructor() {
        this.name = 'kakao';
        this.strategy = new passport_kakao_1.Strategy({
            clientID: process.env.KAKAO_CLIENT_ID || '',
            clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
            callbackURL: process.env.KAKAO_CALLBACK_URL || '',
        }, (accessToken, refreshToken, profile, done) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const existingUser = yield prisma.user.findUnique({
                    where: {
                        kakaoId: profile.id,
                    },
                });
                if (existingUser) {
                    return done(null, existingUser);
                }
                // 새로운 사용자 생성
                const newUser = yield prisma.user.create({
                    data: {
                        email: (_b = (_a = profile._json) === null || _a === void 0 ? void 0 : _a.kakao_account) === null || _b === void 0 ? void 0 : _b.email,
                        name: profile.displayName,
                        kakaoId: profile.id,
                        provider: 'kakao',
                    },
                });
                return done(null, newUser);
            }
            catch (error) {
                console.error('Kakao authentication error:', error);
                return done(error, false);
            }
        }));
    }
}
exports.KakaoPassportStrategy = KakaoPassportStrategy;
