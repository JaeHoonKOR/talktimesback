import { Request, Response } from 'express';
import { prisma } from '../server';
import * as aiSummaryService from '../services/news/ai-summary-service';
import * as newsRepository from '../services/news/news-repository';
import * as rssService from '../services/news/rss-service';
import { getActiveRssSources, getRssSourcesByCategory } from '../services/news/rss-sources';
import { NewsFilterOptions } from '../types/news.types';

// req.user의 타입 확장
declare global {
  namespace Express {
    interface User {
      id: number;
      email?: string;
      kakaoId?: string;
    }
  }
}

/**
 * 최신 뉴스 수집 및 DB 저장
 */
export async function fetchAndSaveNews(req: Request, res: Response) {
  try {
    // 1. 모든 RSS 피드에서 뉴스 가져오기
    const allNews = await rssService.fetchAllNews();
    
    // 2. 중복 제거
    const uniqueNews = rssService.deduplicateNews(allNews);
    
    // 3. DB에 저장
    const savedCount = await newsRepository.saveNewsItems(uniqueNews);
    
    res.status(200).json({
      success: true,
      message: `${savedCount}개의 새로운 뉴스 항목이 저장되었습니다.`,
      total: uniqueNews.length,
      saved: savedCount,
    });
  } catch (error) {
    console.error('뉴스 수집 및 저장 중 오류 발생:', error);
    res.status(500).json({
      success: false,
      message: '뉴스 수집 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });
  }
}

/**
 * 특정 카테고리의 뉴스 수집 및 DB 저장
 */
export async function fetchAndSaveNewsByCategory(req: Request, res: Response) {
  const { category } = req.params;
  
  if (!category) {
    return res.status(400).json({
      success: false,
      message: '카테고리가 지정되지 않았습니다.',
    });
  }
  
  try {
    // 카테고리별 RSS 소스 확인
    const sources = getRssSourcesByCategory(category);
    
    if (sources.length === 0) {
      return res.status(404).json({
        success: false,
        message: `'${category}' 카테고리에 대한 RSS 소스가 없습니다.`,
      });
    }
    
    // 뉴스 가져오기
    const categoryNews = await rssService.fetchNewsByCategory(category);
    
    // 중복 제거
    const uniqueNews = rssService.deduplicateNews(categoryNews);
    
    // DB에 저장
    const savedCount = await newsRepository.saveNewsItems(uniqueNews);
    
    res.status(200).json({
      success: true,
      message: `${category} 카테고리에서 ${savedCount}개의 새로운 뉴스 항목이 저장되었습니다.`,
      category,
      total: uniqueNews.length,
      saved: savedCount,
    });
  } catch (error) {
    console.error(`${category} 카테고리 뉴스 수집 및 저장 중 오류 발생:`, error);
    res.status(500).json({
      success: false,
      message: '뉴스 수집 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });
  }
}

/**
 * 뉴스 목록 가져오기 (필터링 옵션 적용)
 */
export async function getNews(req: Request, res: Response) {
  try {
    // 쿼리 파라미터에서 필터링 옵션 추출
    const {
      categories,
      sources,
      keywords,
      startDate,
      endDate,
      limit = '50',
      offset = '0',
    } = req.query;
    
    // 필터링 옵션 구성
    const options: NewsFilterOptions = {
      categories: Array.isArray(categories) 
        ? categories as string[] 
        : categories 
          ? [categories as string] 
          : undefined,
      sources: Array.isArray(sources) 
        ? sources as string[] 
        : sources 
          ? [sources as string] 
          : undefined,
      keywords: Array.isArray(keywords) 
        ? keywords as string[] 
        : keywords 
          ? [keywords as string] 
          : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };
    
    // 뉴스 조회
    const newsItems = await newsRepository.getNewsItems(options);
    
    // content null을 undefined로 변환
    const formattedNews = newsItems.map(item => ({
      ...item,
      content: item.content || undefined,
      imageUrl: item.imageUrl || undefined
    }));

    res.status(200).json({
      success: true,
      count: newsItems.length,
      data: formattedNews,
    });
  } catch (error) {
    console.error('뉴스 목록 조회 중 오류 발생:', error);
    res.status(500).json({
      success: false,
      message: '뉴스 목록을 가져오는 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });
  }
}

/**
 * 카테고리별 최신 뉴스 가져오기
 */
export async function getLatestNewsByCategory(req: Request, res: Response) {
  const { category } = req.params;
  const { limit = '10' } = req.query;
  
  if (!category) {
    return res.status(400).json({
      success: false,
      message: '카테고리가 지정되지 않았습니다.',
    });
  }
  
  try {
    const newsItems = await newsRepository.getLatestNewsByCategory(
      category,
      parseInt(limit as string, 10)
    );
    
    // content null을 undefined로 변환
    const formattedNews = newsItems.map(item => ({
      ...item,
      content: item.content || undefined,
      imageUrl: item.imageUrl || undefined
    }));

    res.status(200).json({
      success: true,
      category,
      count: newsItems.length,
      data: formattedNews,
    });
  } catch (error) {
    console.error(`${category} 카테고리 최신 뉴스 조회 중 오류 발생:`, error);
    res.status(500).json({
      success: false,
      message: '뉴스 목록을 가져오는 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });
  }
}

/**
 * 단일 뉴스 상세 정보 가져오기
 */
export async function getNewsById(req: Request, res: Response) {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '뉴스 ID가 지정되지 않았습니다.',
    });
  }
  
  try {
    const newsItem = await newsRepository.getNewsById(id);
    
    if (!newsItem) {
      return res.status(404).json({
        success: false,
        message: `ID가 ${id}인 뉴스를 찾을 수 없습니다.`,
      });
    }
    
    // content null을 undefined로 변환
    const formattedNews = {
      ...newsItem,
      content: newsItem.content || undefined,
      imageUrl: newsItem.imageUrl || undefined
    };

    res.status(200).json({
      success: true,
      data: formattedNews,
    });
  } catch (error) {
    console.error(`뉴스 ID ${id} 조회 중 오류 발생:`, error);
    res.status(500).json({
      success: false,
      message: '뉴스 정보를 가져오는 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });
  }
}

/**
 * AI를 이용한 뉴스 요약 생성
 */
export async function summarizeNews(req: Request, res: Response) {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '뉴스 ID가 지정되지 않았습니다.',
    });
  }
  
  try {
    // 뉴스 항목 조회
    const newsItem = await newsRepository.getNewsById(id);
    
    if (!newsItem) {
      return res.status(404).json({
        success: false,
        message: `ID가 ${id}인 뉴스를 찾을 수 없습니다.`,
      });
    }
    
    // 뉴스 요약
    const summary = await aiSummaryService.summarizeNewsItem(newsItem);
    
    // content null을 undefined로 변환
    const formattedNews = {
      ...newsItem,
      content: newsItem.content || undefined,
      imageUrl: newsItem.imageUrl || undefined
    };

    res.status(200).json({
      success: true,
      data: {
        id: formattedNews.id,
        title: formattedNews.title,
        summary,
      },
    });
  } catch (error) {
    console.error(`뉴스 ID ${id} 요약 중 오류 발생:`, error);
    res.status(500).json({
      success: false,
      message: '뉴스 요약을 생성하는 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });
  }
}

/**
 * 처리되지 않은 뉴스 일괄 요약 처리
 */
export async function batchProcessNews(req: Request, res: Response) {
  const { limit = '20' } = req.query;
  
  try {
    const processedCount = await aiSummaryService.batchProcessUnprocessedNews(
      parseInt(limit as string, 10)
    );
    
    res.status(200).json({
      success: true,
      message: `${processedCount}개의 뉴스 항목이 처리되었습니다.`,
      processedCount,
    });
  } catch (error) {
    console.error('뉴스 일괄 처리 중 오류 발생:', error);
    res.status(500).json({
      success: false,
      message: '뉴스 일괄 처리 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });
  }
}

/**
 * 뉴스 통계 정보 가져오기
 */
export async function getNewsStats(req: Request, res: Response) {
  try {
    const stats = await newsRepository.getNewsStats();
    
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('뉴스 통계 조회 중 오류 발생:', error);
    res.status(500).json({
      success: false,
      message: '뉴스 통계를 가져오는 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });
  }
}

/**
 * RSS 소스 목록 가져오기
 */
export async function getRssSources(req: Request, res: Response) {
  try {
    const { category } = req.query;
    
    const sources = category
      ? getRssSourcesByCategory(category as string)
      : getActiveRssSources();
    
    res.status(200).json({
      success: true,
      count: sources.length,
      data: sources,
    });
  } catch (error) {
    console.error('RSS 소스 목록 조회 중 오류 발생:', error);
    res.status(500).json({
      success: false,
      message: 'RSS 소스 목록을 가져오는 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });
  }
}

// 최신 뉴스 조회 API
export const getLatestNews = async (req: Request, res: Response) => {
  try {
    const { limit = '10', lang } = req.query;
    const limitNum = parseInt(limit as string, 10);
    
    // 사용자 언어 설정 확인 (쿼리 파라미터 > 사용자 설정 > 기본값)
    const userLanguage = lang as string || 'ko';
    
    const news = await prisma.news.findMany({
      where: {},
      orderBy: {
        publishedAt: 'desc',
      },
      take: limitNum
    });

    // content null을 undefined로 변환
    const formattedNews = news.map(item => ({
      ...item,
      content: item.content || undefined,
      imageUrl: item.imageUrl || undefined
    }));

    // 한국어가 아닌 경우 번역 적용
    if (userLanguage !== 'ko') {
      const { TranslationService } = await import('../services/translation/translation-service');
      const translationService = new TranslationService();
      
      const translatedNews = await translationService.translateNewsList(formattedNews, userLanguage);
      
      return res.status(200).json({
        success: true,
        data: { 
          news: translatedNews,
          language: userLanguage
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { 
        news: formattedNews,
        language: userLanguage
      },
    });
  } catch (error) {
    console.error('최신 뉴스 조회 중 오류 발생:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: (error as Error).message,
    });
  }
};

// 카테고리별 뉴스 조회 API
export const getNewsByCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { lang } = req.query;
    
    // 사용자 언어 설정 확인
    const userLanguage = lang as string || 'ko';
    
    const news = await prisma.news.findMany({
      where: {
        category,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 20
    });

    // content null을 undefined로 변환
    const formattedNews = news.map(item => ({
      ...item,
      content: item.content || undefined,
      imageUrl: item.imageUrl || undefined
    }));

    // 한국어가 아닌 경우 번역 적용
    if (userLanguage !== 'ko') {
      const { TranslationService } = await import('../services/translation/translation-service');
      const translationService = new TranslationService();
      
      const translatedNews = await translationService.translateNewsList(formattedNews, userLanguage);
      
      return res.status(200).json({
        success: true,
        data: { 
          news: translatedNews,
          category,
          language: userLanguage
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { 
        news: formattedNews,
        category,
        language: userLanguage
      },
    });
  } catch (error) {
    console.error('카테고리별 뉴스 조회 중 오류 발생:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: (error as Error).message,
    });
  }
};

// 사용자 키워드 기반 맞춤형 뉴스 조회 API
export const getPersonalizedNews = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const { lang } = req.query;
    const userLanguage = lang as string || 'ko';

    // 사용자 키워드 조회
    const userKeywords = await prisma.keyword.findMany({
      where: { userId: parseInt(userId, 10) },
    });

    if (userKeywords.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          message: '설정된 키워드가 없습니다. 키워드를 추가하면 맞춤형 뉴스를 제공해 드립니다.',
          news: [],
          language: userLanguage
        },
      });
    }

    // 키워드 텍스트 추출
    const keywordTexts = userKeywords.map((k) => k.keyword);

    // 키워드 기반 뉴스 검색 (제목 또는 요약에 키워드가 포함된 뉴스)
    const news = await prisma.news.findMany({
      where: {
        OR: keywordTexts.flatMap(keyword => [
          {
            title: {
              contains: keyword,
              mode: 'insensitive' as const,
            },
          },
          {
            excerpt: {
              contains: keyword,
              mode: 'insensitive' as const,
            },
          },
        ]),
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 20
    });

    // content null을 undefined로 변환
    const formattedNews = news.map(item => ({
      ...item,
      content: item.content || undefined,
      imageUrl: item.imageUrl || undefined
    }));

    // 한국어가 아닌 경우 번역 적용
    if (userLanguage !== 'ko') {
      const { TranslationService } = await import('../services/translation/translation-service');
      const translationService = new TranslationService();
      
      const translatedNews = await translationService.translateNewsList(formattedNews, userLanguage);
      
      return res.status(200).json({
        success: true,
        data: {
          news: translatedNews,
          keywords: keywordTexts,
          language: userLanguage
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        news: formattedNews,
        keywords: keywordTexts,
        language: userLanguage
      },
    });
  } catch (error) {
    console.error('맞춤형 뉴스 조회 중 오류 발생:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: (error as Error).message,
    });
  }
};

// 키워드 기반 뉴스 검색 API
export const searchNewsByKeywords = async (req: Request, res: Response) => {
  try {
    const { keywords } = req.body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          news: [],
          message: "검색할 키워드를 입력해주세요."
        }
      });
    }

    console.log('키워드 검색 요청:', keywords);

    // 키워드 기반 뉴스 검색 (제목 또는 내용에 키워드가 포함된 뉴스)
    const news = await prisma.news.findMany({
      where: {
        OR: keywords.flatMap(keyword => [
          {
            title: {
              contains: keyword,
              mode: 'insensitive' as const,
            },
          },
          {
            excerpt: {
              contains: keyword,
              mode: 'insensitive' as const,
            },
          },
        ]),
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 20,
    });

    console.log(`검색 결과: ${news.length}개 항목 찾음`);
    
    // 각 뉴스 항목에 정확히 매칭된 키워드 추가
    const newsWithMatchingKeywords = news.map(newsItem => {
      // 이 뉴스에 포함된 키워드 찾기 (단어 경계를 고려한 정확한 매칭)
      const matchingKeywords = keywords.filter(keyword => {
        // 키워드가 짧은 경우 (3글자 미만)는 단어 경계 검사를 더 엄격하게 수행
        if (keyword.length < 3) {
          const titleRegex = new RegExp(`\\b${keyword}\\b|\\b${keyword}[가-힣]|[가-힣]${keyword}\\b`, 'i');
          const excerptRegex = new RegExp(`\\b${keyword}\\b|\\b${keyword}[가-힣]|[가-힣]${keyword}\\b`, 'i');
          return titleRegex.test(newsItem.title) || excerptRegex.test(newsItem.excerpt);
        }
        
        // 영어 키워드는 단어 경계 검사
        if (/^[a-zA-Z]+$/.test(keyword)) {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(newsItem.title) || regex.test(newsItem.excerpt);
        }
        
        // 한글 및 기타 키워드는 일반 포함 검사
        const lowerKeyword = keyword.toLowerCase();
        const lowerTitle = newsItem.title.toLowerCase();
        const lowerExcerpt = newsItem.excerpt.toLowerCase();
        
        return lowerTitle.includes(lowerKeyword) || lowerExcerpt.includes(lowerKeyword);
      });
      
      // 뉴스 항목에 매칭된 키워드 정보 추가
      return {
        ...newsItem,
        matchingKeywords
      };
    });

    // 매칭된 키워드가 있는 뉴스만 필터링
    const filteredNews = newsWithMatchingKeywords.filter(item => item.matchingKeywords.length > 0);

    return res.status(200).json({
      success: true,
      data: {
        news: filteredNews,
        keywords,
        message: filteredNews.length > 0 
          ? `'${keywords.join(', ')}' 키워드에 대한 ${filteredNews.length}개의 뉴스를 찾았습니다.` 
          : "입력하신 키워드에 맞는 뉴스를 찾을 수 없습니다."
      },
    });
  } catch (error) {
    console.error('키워드 검색 중 오류 발생:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: (error as Error).message,
    });
  }
}; 