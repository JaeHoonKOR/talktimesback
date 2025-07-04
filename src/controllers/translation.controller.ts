import { Request, Response } from 'express';
import { TranslationCacheManager } from '../services/translation/cache-manager';
import { TranslationService } from '../services/translation/translation-service';

const translationService = new TranslationService();
const cacheManager = new TranslationCacheManager();

export const translateText = async (req: Request, res: Response) => {
  try {
    const { text, targetLang } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({ 
        error: '텍스트와 대상 언어가 필요합니다.' 
      });
    }

    const translatedText = await translationService.translateText(text, targetLang);
    res.json({ translatedText });
  } catch (error) {
    console.error('번역 요청 처리 중 오류:', error);
    res.status(500).json({ 
      error: '번역 처리 중 오류가 발생했습니다.' 
    });
  }
};

export const translateBatch = async (req: Request, res: Response) => {
  try {
    const { texts, targetLang } = req.body;

    if (!Array.isArray(texts) || !targetLang) {
      return res.status(400).json({ 
        error: '텍스트 배열과 대상 언어가 필요합니다.' 
      });
    }

    const translatedTexts = await translationService.translateBatch(texts, targetLang);
    res.json({ translatedTexts });
  } catch (error) {
    console.error('배치 번역 요청 처리 중 오류:', error);
    res.status(500).json({ 
      error: '배치 번역 처리 중 오류가 발생했습니다.' 
    });
  }
};

export const getCacheStatus = async (_req: Request, res: Response) => {
  try {
    const status = await cacheManager.getCacheStatus();
    res.json(status);
  } catch (error) {
    console.error('캐시 상태 조회 중 오류:', error);
    res.status(500).json({ 
      error: '캐시 상태 조회 중 오류가 발생했습니다.' 
    });
  }
};

export const cleanupCache = async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = Number(days);
    
    if (isNaN(daysNum) || daysNum < 1) {
      return res.status(400).json({ 
        error: '유효한 일수를 지정해주세요.' 
      });
    }

    const count = await cacheManager.cleanupOldTranslations(daysNum);
    res.json({ 
      message: `${count}개의 오래된 번역을 정리했습니다.` 
    });
  } catch (error) {
    console.error('캐시 정리 중 오류:', error);
    res.status(500).json({ 
      error: '캐시 정리 중 오류가 발생했습니다.' 
    });
  }
};

export const clearLanguageCache = async (req: Request, res: Response) => {
  try {
    const { targetLang } = req.params;
    
    if (!targetLang) {
      return res.status(400).json({ 
        error: '대상 언어를 지정해주세요.' 
      });
    }

    const count = await cacheManager.clearTranslationsByLanguage(targetLang);
    res.json({ 
      message: `${targetLang} 언어의 ${count}개 번역을 삭제했습니다.` 
    });
  } catch (error) {
    console.error('언어별 캐시 삭제 중 오류:', error);
    res.status(500).json({ 
      error: '언어별 캐시 삭제 중 오류가 발생했습니다.' 
    });
  }
};

export const clearAllCache = async (_req: Request, res: Response) => {
  try {
    const count = await cacheManager.clearAllTranslations();
    res.json({ 
      message: `전체 ${count}개의 번역을 삭제했습니다.` 
    });
  } catch (error) {
    console.error('전체 캐시 삭제 중 오류:', error);
    res.status(500).json({ 
      error: '전체 캐시 삭제 중 오류가 발생했습니다.' 
    });
  }
}; 