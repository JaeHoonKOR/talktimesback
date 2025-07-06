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

// 새로운 번역 생성 (인증된 사용자)
export const createTranslation = async (req: Request, res: Response) => {
  try {
    const { text, targetLang, sourceLang = 'auto' } = req.body;
    const userId = (req as any).user?.id;

    if (!text || !targetLang) {
      return res.status(400).json({ 
        error: '텍스트와 대상 언어가 필요합니다.' 
      });
    }

    const result = await translationService.translateText(text, targetLang, sourceLang, userId);
    res.json(result);
  } catch (error) {
    console.error('번역 생성 중 오류:', error);
    res.status(500).json({ 
      error: '번역 생성 중 오류가 발생했습니다.' 
    });
  }
};

// 배치 번역 생성
export const createBatchTranslations = async (req: Request, res: Response) => {
  try {
    const { texts, targetLang, sourceLang = 'auto' } = req.body;
    const userId = (req as any).user?.id;

    if (!Array.isArray(texts) || !targetLang) {
      return res.status(400).json({ 
        error: '텍스트 배열과 대상 언어가 필요합니다.' 
      });
    }

    const results = await translationService.translateBatch(texts, targetLang, sourceLang, userId);
    res.json({ translations: results });
  } catch (error) {
    console.error('배치 번역 생성 중 오류:', error);
    res.status(500).json({ 
      error: '배치 번역 생성 중 오류가 발생했습니다.' 
    });
  }
};

// 특정 번역 조회
export const getTranslation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const translation = await translationService.getTranslationById(id);
    
    if (!translation) {
      return res.status(404).json({ 
        error: '번역을 찾을 수 없습니다.' 
      });
    }

    res.json(translation);
  } catch (error) {
    console.error('번역 조회 중 오류:', error);
    res.status(500).json({ 
      error: '번역 조회 중 오류가 발생했습니다.' 
    });
  }
};

// 번역 히스토리 조회
export const getTranslationHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { page = 1, limit = 20 } = req.query;
    
    const history = await translationService.getUserTranslationHistory(
      userId, 
      Number(page), 
      Number(limit)
    );
    
    res.json(history);
  } catch (error) {
    console.error('번역 히스토리 조회 중 오류:', error);
    res.status(500).json({ 
      error: '번역 히스토리 조회 중 오류가 발생했습니다.' 
    });
  }
};

// 번역 삭제
export const deleteTranslation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    const deleted = await translationService.deleteTranslation(id, userId);
    
    if (!deleted) {
      return res.status(404).json({ 
        error: '번역을 찾을 수 없거나 삭제 권한이 없습니다.' 
      });
    }

    res.json({ message: '번역이 삭제되었습니다.' });
  } catch (error) {
    console.error('번역 삭제 중 오류:', error);
    res.status(500).json({ 
      error: '번역 삭제 중 오류가 발생했습니다.' 
    });
  }
};

// 공개 번역 생성
export const createPublicTranslation = async (req: Request, res: Response) => {
  try {
    const { text, targetLang, sourceLang = 'auto' } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({ 
        error: '텍스트와 대상 언어가 필요합니다.' 
      });
    }

    // 공개 API는 캐시만 사용, DB 저장 안함
    const result = await translationService.translateText(text, targetLang, sourceLang);
    res.json(result);
  } catch (error) {
    console.error('공개 번역 생성 중 오류:', error);
    res.status(500).json({ 
      error: '공개 번역 생성 중 오류가 발생했습니다.' 
    });
  }
};

// 사용자 번역 설정 조회
export const getUserTranslationPreferences = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const preferences = await translationService.getUserPreferences(userId);
    res.json(preferences);
  } catch (error) {
    console.error('사용자 번역 설정 조회 중 오류:', error);
    res.status(500).json({ 
      error: '사용자 번역 설정 조회 중 오류가 발생했습니다.' 
    });
  }
};

// 사용자 번역 설정 업데이트
export const updateUserTranslationPreferences = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const preferences = req.body;
    
    const updated = await translationService.updateUserPreferences(userId, preferences);
    res.json(updated);
  } catch (error) {
    console.error('사용자 번역 설정 업데이트 중 오류:', error);
    res.status(500).json({ 
      error: '사용자 번역 설정 업데이트 중 오류가 발생했습니다.' 
    });
  }
};

// 번역 캐시 상태 조회
export const getTranslationCacheStatus = async (req: Request, res: Response) => {
  try {
    const status = await cacheManager.getCacheStatus();
    res.json(status);
  } catch (error) {
    console.error('번역 캐시 상태 조회 중 오류:', error);
    res.status(500).json({ 
      error: '번역 캐시 상태 조회 중 오류가 발생했습니다.' 
    });
  }
};

// 번역 캐시 정리
export const cleanupTranslationCache = async (req: Request, res: Response) => {
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
    console.error('번역 캐시 정리 중 오류:', error);
    res.status(500).json({ 
      error: '번역 캐시 정리 중 오류가 발생했습니다.' 
    });
  }
};

// 특정 언어 번역 캐시 삭제
export const clearLanguageTranslationCache = async (req: Request, res: Response) => {
  try {
    const { lang } = req.params;
    
    if (!lang) {
      return res.status(400).json({ 
        error: '대상 언어를 지정해주세요.' 
      });
    }

    const count = await cacheManager.clearTranslationsByLanguage(lang);
    res.json({ 
      message: `${lang} 언어의 ${count}개 번역을 삭제했습니다.` 
    });
  } catch (error) {
    console.error('언어별 번역 캐시 삭제 중 오류:', error);
    res.status(500).json({ 
      error: '언어별 번역 캐시 삭제 중 오류가 발생했습니다.' 
    });
  }
};

// 번역 통계 조회
export const getTranslationStatistics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await translationService.getTranslationStatistics(
      startDate as string, 
      endDate as string
    );
    res.json(stats);
  } catch (error) {
    console.error('번역 통계 조회 중 오류:', error);
    res.status(500).json({ 
      error: '번역 통계 조회 중 오류가 발생했습니다.' 
    });
  }
};

// 언어별 번역 통계 조회
export const getLanguageStatistics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await translationService.getLanguageStatistics(
      startDate as string, 
      endDate as string
    );
    res.json(stats);
  } catch (error) {
    console.error('언어별 번역 통계 조회 중 오류:', error);
    res.status(500).json({ 
      error: '언어별 번역 통계 조회 중 오류가 발생했습니다.' 
    });
  }
}; 