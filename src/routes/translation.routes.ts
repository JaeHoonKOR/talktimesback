import { Request, Response, Router } from 'express';
import {
    cleanupCache,
    clearAllCache,
    clearLanguageCache,
    getCacheStatus,
    translateBatch,
    translateText
} from '../controllers/translation.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { prisma } from '../server';
import { TranslationCacheManager } from '../services/translation/cache-manager';
import { TranslationService } from '../services/translation/translation-service';

const router = Router();
const translationService = new TranslationService();
const cacheManager = new TranslationCacheManager();

/**
 * 뉴스 번역 API
 * GET /api/translation/news/:id?lang=en
 */
router.get('/news/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { lang = 'ko' } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: '뉴스 ID가 필요합니다.'
      });
    }

    const translatedNews = await translationService.translateNews(id, lang as string);

    if (!translatedNews) {
      return res.status(404).json({
        success: false,
        message: '뉴스를 찾을 수 없습니다.'
      });
    }

    return res.json({
      success: true,
      data: translatedNews
    });
  } catch (error) {
    console.error('뉴스 번역 API 오류:', error);
    return res.status(500).json({
      success: false,
      message: '번역 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 사용자 언어 설정 업데이트 API
 * POST /api/translation/user/language
 */
router.post('/user/language', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { language } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.'
      });
    }

    if (!language) {
      return res.status(400).json({
        success: false,
        message: '언어 설정이 필요합니다.'
      });
    }

    // 지원하는 언어 확인
    const supportedLanguages = ['ko', 'en', 'ja'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: '지원하지 않는 언어입니다.',
        supportedLanguages
      });
    }

    // 사용자 언어 설정 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { language },
      select: {
        id: true,
        name: true,
        language: true
      }
    });

    return res.json({
      success: true,
      message: '언어 설정이 업데이트되었습니다.',
      data: updatedUser
    });
  } catch (error) {
    console.error('언어 설정 업데이트 오류:', error);
    return res.status(500).json({
      success: false,
      message: '언어 설정 업데이트 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 번역 통계 조회 API (관리자용)
 * GET /api/translation/stats
 */
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    // TODO: 관리자 권한 확인 로직 추가
    // const isAdmin = req.user?.role === 'admin';
    // if (!isAdmin) {
    //   return res.status(403).json({
    //     success: false,
    //     message: '관리자 권한이 필요합니다.'
    //   });
    // }

    const stats = await cacheManager.getTranslationStats();
    const cacheStatus = await cacheManager.getCacheStatus();

    return res.json({
      success: true,
      data: {
        ...stats,
        cacheStatus
      }
    });
  } catch (error) {
    console.error('번역 통계 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 번역 캐시 상태 조회 API
 * GET /api/translation/cache/status
 */
router.get('/cache/status', authenticateToken, getCacheStatus);

/**
 * 번역 캐시 정리 API (관리자용)
 * DELETE /api/translation/cache/cleanup
 */
router.post('/cache/cleanup', authenticateToken, cleanupCache);

/**
 * 특정 언어의 번역 캐시 삭제 API (관리자용)
 * DELETE /api/translation/cache/:language
 */
router.delete('/cache/language/:targetLang', authenticateToken, clearLanguageCache);

/**
 * 번역 캐시 전체 삭제 API (관리자용)
 * DELETE /api/translation/cache/all
 */
router.delete('/cache/all', authenticateToken, clearAllCache);

/**
 * 텍스트 번역 API
 * POST /api/translation/text
 */
router.post('/text', authenticateToken, translateText);

/**
 * 번역 배치 API
 * POST /api/translation/batch
 */
router.post('/batch', authenticateToken, translateBatch);

/**
 * 공개 텍스트 번역 API
 * POST /api/translation/public/text
 */
router.post('/public/text', async (req: Request, res: Response) => {
  try {
    const { text, targetLang = 'ko' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: '번역할 텍스트가 필요합니다.'
      });
    }

    const translatedText = await translationService.translateText(text, targetLang);

    return res.json({
      success: true,
      data: { translatedText }
    });
  } catch (error) {
    console.error('공개 번역 API 오류:', error);
    return res.status(500).json({
      success: false,
      message: '번역 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 공개 배치 번역 API
 * POST /api/translation/public/batch
 */
router.post('/public/batch', async (req: Request, res: Response) => {
  try {
    const { texts, targetLang = 'ko' } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        message: '번역할 텍스트 배열이 필요합니다.'
      });
    }

    // 요청당 최대 10개 텍스트로 제한
    if (texts.length > 10) {
      return res.status(400).json({
        success: false,
        message: '한 번에 최대 10개의 텍스트만 번역 가능합니다.'
      });
    }

    const translatedTexts = await translationService.translateBatch(texts, targetLang);

    return res.json({
      success: true,
      data: { translatedTexts }
    });
  } catch (error) {
    console.error('공개 배치 번역 API 오류:', error);
    return res.status(500).json({
      success: false,
      message: '배치 번역 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 