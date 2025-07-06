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
exports.detectLocationMiddleware = detectLocationMiddleware;
// jiksend-backend/src/middlewares/location.middleware.ts 파일 생성
const axios_1 = __importDefault(require("axios"));
// 언어 코드와 국가 매핑
const COUNTRY_LANGUAGE_MAP = {
    'KR': 'ko',
    'JP': 'ja',
    'CN': 'zh',
    'TW': 'zh-TW',
    'US': 'en',
    'GB': 'en',
    'DE': 'de',
    'FR': 'fr',
    'ES': 'es',
    // 필요한 만큼 추가
};
// 기본 언어
const DEFAULT_LANGUAGE = 'en';
function detectLocationMiddleware(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 헤더에서 IP 주소 가져오기
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            // 사용자가 헤더로 언어 지정한 경우 그것을 우선
            if (req.headers['accept-language']) {
                const language = req.headers['accept-language'].split(',')[0].split('-')[0];
                req.userLanguage = language;
                next();
                return;
            }
            // IP 기반 국가 감지 (IP-API 무료 서비스 예시)
            const geoResponse = yield axios_1.default.get(`http://ip-api.com/json/${ip}`);
            const country = geoResponse.data.countryCode;
            // 국가에 맞는 언어 코드 설정
            req.userLanguage = COUNTRY_LANGUAGE_MAP[country] || DEFAULT_LANGUAGE;
            next();
        }
        catch (error) {
            console.error('위치 감지 중 오류:', error);
            req.userLanguage = DEFAULT_LANGUAGE;
            next();
        }
    });
}
