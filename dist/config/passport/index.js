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
exports.initializePassport = initializePassport;
const client_1 = require("@prisma/client");
const passport_1 = __importDefault(require("passport"));
const kakao_strategy_1 = require("./kakao.strategy");
const prisma = new client_1.PrismaClient();
function initializePassport() {
    // 사용자 직렬화
    passport_1.default.serializeUser((user, done) => {
        done(null, user.id);
    });
    // 사용자 역직렬화
    passport_1.default.deserializeUser((id, done) => __awaiter(this, void 0, void 0, function* () {
        try {
            const user = yield prisma.user.findUnique({
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
            }
            else {
                done(null, null);
            }
        }
        catch (error) {
            done(error, null);
        }
    }));
    // 카카오 전략 등록
    const kakaoStrategy = new kakao_strategy_1.KakaoPassportStrategy();
    passport_1.default.use(kakaoStrategy.name, kakaoStrategy.strategy);
}
