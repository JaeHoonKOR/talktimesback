// jiksend-backend/src/middlewares/location.middleware.ts 파일 생성
import axios from 'axios';
import { NextFunction, Request, Response } from 'express';

// 언어 코드와 국가 매핑
const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
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

export async function detectLocationMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
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
    const geoResponse = await axios.get(`http://ip-api.com/json/${ip}`);
    const country = geoResponse.data.countryCode;
    
    // 국가에 맞는 언어 코드 설정
    req.userLanguage = COUNTRY_LANGUAGE_MAP[country] || DEFAULT_LANGUAGE;
    
    next();
  } catch (error) {
    console.error('위치 감지 중 오류:', error);
    req.userLanguage = DEFAULT_LANGUAGE;
    next();
  }
}