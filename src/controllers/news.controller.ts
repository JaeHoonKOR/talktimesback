import { Request, Response } from "express";
import { prisma } from '../server';
import * as aiSummaryService from '../services/news/ai-summary-service';
import * as newsRepository from '../services/news/news-repository';
import * as rssService from '../services/news/rss-service';
import { getRssSourcesByCategory } from '../services/news/rss-sources';
import { NewsFilterOptions } from '../types/news.types';
import { ResponseHelper } from '../utils/response.helper';

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
    
    const result = {
      message: `${savedCount}개의 새로운 뉴스 항목이 저장되었습니다.`,
      total: uniqueNews.length,
      saved: savedCount,
    };

    return ResponseHelper.success(res, result);
  } catch (error) {
    console.error('뉴스 수집 및 저장 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 수집 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 카테고리의 뉴스 수집 및 DB 저장
 */
export async function fetchAndSaveNewsByCategory(req: Request, res: Response) {
  const { category } = req.params;
  
  try {
    // 카테고리별 RSS 소스 확인
    const sources = getRssSourcesByCategory(category);
    
    if (sources.length === 0) {
      return ResponseHelper.notFound(res, `'${category}' 카테고리에 대한 RSS 소스가 없습니다.`);
    }
    
    // 뉴스 가져오기
    const categoryNews = await rssService.fetchNewsByCategory(category);
    
    // 중복 제거
    const uniqueNews = rssService.deduplicateNews(categoryNews);
    
    // DB에 저장
    const savedCount = await newsRepository.saveNewsItems(uniqueNews);
    
    const result = {
      message: `${category} 카테고리에서 ${savedCount}개의 새로운 뉴스 항목이 저장되었습니다.`,
      category,
      total: uniqueNews.length,
      saved: savedCount,
    };

    return ResponseHelper.success(res, result);
  } catch (error) {
    console.error(`${category} 카테고리 뉴스 수집 및 저장 중 오류 발생:`, error);
    return ResponseHelper.internalServerError(res, '뉴스 수집 중 오류가 발생했습니다.');
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
      page = '1',
      limit = '50',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
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
      limit: limitNum,
      offset: offset,
    };
    
    // 뉴스 조회
    const newsItems = await newsRepository.getNewsItems(options);
    
    // content null을 undefined로 변환
    const formattedNews = newsItems.map(item => ({
      ...item,
      content: item.content || undefined,
      imageUrl: item.imageUrl || undefined,
      publishedAt: item.publishedAt.toISOString(),
      createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: item.updatedAt?.toISOString() || new Date().toISOString()
    }));

    // 총 개수 조회 (페이지네이션용)
    const totalCount = newsItems.length;

    return ResponseHelper.paginatedSuccess(
      res, 
      formattedNews, 
      pageNum, 
      limitNum, 
      totalCount
    );
  } catch (error) {
    console.error('뉴스 목록 조회 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 목록을 가져오는 중 오류가 발생했습니다.');
  }
}

/**
 * 뉴스 검색 (키워드 기반)
 */
export async function searchNewsByKeywords(req: Request, res: Response) {
  try {
    const {
      keywords,
      category,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // 키워드 파싱
    let keywordArray: string[] = [];
    if (typeof keywords === 'string') {
      keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    } else if (Array.isArray(keywords)) {
      keywordArray = keywords as string[];
    }

    const options: NewsFilterOptions = {
      keywords: keywordArray,
      categories: category ? [category as string] : undefined,
      limit: limitNum,
      offset: offset,
    };

    const newsItems = await newsRepository.getNewsItems(options);
    const totalCount = newsItems.length;

    const formattedNews = newsItems.map(item => ({
      ...item,
      content: item.content || undefined,
      imageUrl: item.imageUrl || undefined,
      publishedAt: item.publishedAt.toISOString(),
      createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: item.updatedAt?.toISOString() || new Date().toISOString()
    }));

    return ResponseHelper.paginatedSuccess(
      res, 
      formattedNews, 
      pageNum, 
      limitNum, 
      totalCount
    );
  } catch (error) {
    console.error('뉴스 검색 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 검색 중 오류가 발생했습니다.');
  }
}

/**
 * 최신 뉴스 가져오기
 */
export async function getLatestNews(req: Request, res: Response) {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const options: NewsFilterOptions = {
      limit: limitNum,
      offset: 0,
    };

    const newsItems = await newsRepository.getNewsItems(options);

    const formattedNews = newsItems.map(item => ({
      ...item,
      content: item.content || undefined,
      imageUrl: item.imageUrl || undefined,
      publishedAt: item.publishedAt.toISOString(),
      createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: item.updatedAt?.toISOString() || new Date().toISOString()
    }));

    return ResponseHelper.success(res, formattedNews);
  } catch (error) {
    console.error('최신 뉴스 조회 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '최신 뉴스를 가져오는 중 오류가 발생했습니다.');
  }
}

/**
 * 카테고리별 뉴스 가져오기
 */
export async function getNewsByCategory(req: Request, res: Response) {
  const { category } = req.params;
  
  try {
    const {
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const options: NewsFilterOptions = {
      categories: [category],
      limit: limitNum,
      offset: offset,
    };

    const newsItems = await newsRepository.getNewsItems(options);
    const totalCount = newsItems.length;

    const formattedNews = newsItems.map(item => ({
      ...item,
      content: item.content || undefined,
      imageUrl: item.imageUrl || undefined,
      publishedAt: item.publishedAt.toISOString(),
      createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: item.updatedAt?.toISOString() || new Date().toISOString()
    }));

    return ResponseHelper.paginatedSuccess(
      res, 
      formattedNews, 
      pageNum, 
      limitNum, 
      totalCount
    );
  } catch (error) {
    console.error(`${category} 카테고리 뉴스 조회 중 오류 발생:`, error);
    return ResponseHelper.internalServerError(res, '카테고리별 뉴스를 가져오는 중 오류가 발생했습니다.');
  }
}

/**
 * 개인화된 뉴스 가져오기
 */
export async function getPersonalizedNews(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return ResponseHelper.unauthorized(res, '로그인이 필요합니다.');
    }

    // 사용자 키워드 조회
    const userKeywords = await prisma.keyword.findMany({
      where: { userId },
      select: { keyword: true }
    });

    if (userKeywords.length === 0) {
      return ResponseHelper.success(res, [], '설정된 키워드가 없습니다.');
    }

    const keywords = userKeywords.map(k => k.keyword);
    
    const {
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const options: NewsFilterOptions = {
      keywords,
      limit: limitNum,
      offset: offset,
    };

    const newsItems = await newsRepository.getNewsItems(options);
    const totalCount = newsItems.length;

    const formattedNews = newsItems.map(item => ({
      ...item,
      content: item.content || undefined,
      imageUrl: item.imageUrl || undefined,
      publishedAt: item.publishedAt.toISOString(),
      createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: item.updatedAt?.toISOString() || new Date().toISOString()
    }));

    return ResponseHelper.paginatedSuccess(
      res, 
      formattedNews, 
      pageNum, 
      limitNum, 
      totalCount
    );
  } catch (error) {
    console.error('개인화 뉴스 조회 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '개인화 뉴스를 가져오는 중 오류가 발생했습니다.');
  }
}

/**
 * 뉴스 ID로 단일 뉴스 가져오기
 */
export async function getNewsById(req: Request, res: Response) {
  const { id } = req.params;
  
  try {
    const newsItem = await prisma.news.findUnique({
      where: { id }
    });

    if (!newsItem) {
      return ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
    }

    const formattedNews = {
      ...newsItem,
      content: newsItem.content || undefined,
      imageUrl: newsItem.imageUrl || undefined,
      publishedAt: newsItem.publishedAt.toISOString(),
      createdAt: newsItem.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: newsItem.updatedAt?.toISOString() || new Date().toISOString()
    };

    return ResponseHelper.success(res, formattedNews);
  } catch (error) {
    console.error('뉴스 조회 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스를 가져오는 중 오류가 발생했습니다.');
  }
}

/**
 * 뉴스 AI 요약 조회
 */
export async function summarizeNews(req: Request, res: Response) {
  const { id } = req.params;
  
  try {
    const newsItem = await prisma.news.findUnique({
      where: { id }
    });

    if (!newsItem) {
      return ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
    }

    // AI 요약이 이미 있는 경우 반환
    if (newsItem.aiSummary) {
      return ResponseHelper.success(res, {
        id: newsItem.id,
        title: newsItem.title,
        summary: newsItem.aiSummary
      });
    }

    // AI 요약 생성
    try {
      const summary = await aiSummaryService.generateSummary(newsItem.content || newsItem.excerpt);
      
      // DB에 요약 저장
      await prisma.news.update({
        where: { id },
        data: { aiSummary: summary }
      });

      return ResponseHelper.success(res, {
        id: newsItem.id,
        title: newsItem.title,
        summary: summary
      });
    } catch (aiError) {
      console.error('AI 요약 생성 실패:', aiError);
      return ResponseHelper.internalServerError(res, 'AI 요약 생성 중 오류가 발생했습니다.');
    }
  } catch (error) {
    console.error('뉴스 요약 조회 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 요약을 가져오는 중 오류가 발생했습니다.');
  }
}

/**
 * 처리되지 않은 뉴스 일괄 처리
 */
export async function batchProcessNews(req: Request, res: Response) {
  try {
    // 처리되지 않은 뉴스 조회
    const unprocessedNews = await prisma.news.findMany({
      where: { isProcessed: false },
      take: 50 // 한 번에 50개씩 처리
    });

    if (unprocessedNews.length === 0) {
      return ResponseHelper.success(res, {
        message: '처리할 뉴스가 없습니다.',
        processed: 0
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    // 각 뉴스에 대해 AI 요약 생성
    for (const news of unprocessedNews) {
      try {
        if (!news.aiSummary && (news.content || news.excerpt)) {
          const summary = await aiSummaryService.generateSummary(news.content || news.excerpt);
          
          await prisma.news.update({
            where: { id: news.id },
            data: { 
              aiSummary: summary,
              isProcessed: true
            }
          });
          
          processedCount++;
        } else {
          // 요약할 내용이 없는 경우 처리 완료로 표시
          await prisma.news.update({
            where: { id: news.id },
            data: { isProcessed: true }
          });
          
          processedCount++;
        }
      } catch (error) {
        console.error(`뉴스 ${news.id} 처리 실패:`, error);
        errors.push(`뉴스 ${news.id}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    return ResponseHelper.success(res, {
      message: `${processedCount}개의 뉴스가 처리되었습니다.`,
      processed: processedCount,
      total: unprocessedNews.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('뉴스 일괄 처리 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 일괄 처리 중 오류가 발생했습니다.');
  }
}

/**
 * RSS 피드 소스 목록 조회
 */
export async function getRssSources(req: Request, res: Response) {
  try {
    const sources = getActiveRssSources();
    
    const sourceList = sources.map(source => ({
      name: source.name,
      category: source.category,
      url: source.url,
      description: source.description || `${source.name} RSS 피드`
    }));

    return ResponseHelper.success(res, {
      sources: sourceList,
      total: sourceList.length
    });
  } catch (error) {
    console.error('RSS 소스 목록 조회 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, 'RSS 소스 목록을 가져오는 중 오류가 발생했습니다.');
  }
}

/**
 * 뉴스 통계 정보 조회
 */
export async function getNewsStats(req: Request, res: Response) {
  try {
    // 전체 뉴스 수
    const totalNews = await prisma.news.count();
    
    // 카테고리별 뉴스 수
    const newsByCategory = await prisma.news.groupBy({
      by: ['category'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    // 소스별 뉴스 수
    const newsBySource = await prisma.news.groupBy({
      by: ['source'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10 // 상위 10개 소스만
    });

    // 최근 24시간 뉴스 수
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentNews = await prisma.news.count({
      where: {
        createdAt: {
          gte: yesterday
        }
      }
    });

    // 처리된 뉴스 수
    const processedNews = await prisma.news.count({
      where: { isProcessed: true }
    });

    const stats = {
      total: totalNews,
      recent24h: recentNews,
      processed: processedNews,
      unprocessed: totalNews - processedNews,
      byCategory: newsByCategory.map(item => ({
        category: item.category,
        count: item._count.id
      })),
      bySource: newsBySource.map(item => ({
        source: item.source,
        count: item._count.id
      })),
      processingRate: totalNews > 0 ? Math.round((processedNews / totalNews) * 100) : 0
    };

    return ResponseHelper.success(res, stats);
  } catch (error) {
    console.error('뉴스 통계 조회 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 통계를 가져오는 중 오류가 발생했습니다.');
  }
}

/**
 * 뉴스 정보 업데이트
 */
export async function updateNews(req: Request, res: Response) {
  const { id } = req.params;
  const { title, content, excerpt, category, imageUrl } = req.body;
  
  try {
    const existingNews = await prisma.news.findUnique({
      where: { id }
    });

    if (!existingNews) {
      return ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
    }

    const updatedNews = await prisma.news.update({
      where: { id },
      data: {
        title: title || existingNews.title,
        content: content || existingNews.content,
        excerpt: excerpt || existingNews.excerpt,
        category: category || existingNews.category,
        imageUrl: imageUrl || existingNews.imageUrl,
        updatedAt: new Date()
      }
    });

    const formattedNews = {
      ...updatedNews,
      content: updatedNews.content || undefined,
      imageUrl: updatedNews.imageUrl || undefined,
      publishedAt: updatedNews.publishedAt.toISOString(),
      createdAt: updatedNews.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: updatedNews.updatedAt?.toISOString() || new Date().toISOString()
    };

    return ResponseHelper.success(res, formattedNews, '뉴스가 성공적으로 업데이트되었습니다.');
  } catch (error) {
    console.error('뉴스 업데이트 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 업데이트 중 오류가 발생했습니다.');
  }
}

/**
 * 뉴스 삭제
 */
export async function deleteNews(req: Request, res: Response) {
  const { id } = req.params;
  
  try {
    const existingNews = await prisma.news.findUnique({
      where: { id }
    });

    if (!existingNews) {
      return ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
    }

    await prisma.news.delete({
      where: { id }
    });

    return ResponseHelper.success(res, { id }, '뉴스가 성공적으로 삭제되었습니다.');
  } catch (error) {
    console.error('뉴스 삭제 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 삭제 중 오류가 발생했습니다.');
  }
}

/**
 * 뉴스 AI 요약 생성
 */
export async function createNewsSummary(req: Request, res: Response) {
  const { id } = req.params;
  
  try {
    const newsItem = await prisma.news.findUnique({
      where: { id }
    });

    if (!newsItem) {
      return ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
    }

    // 이미 요약이 있는 경우
    if (newsItem.aiSummary) {
      return ResponseHelper.success(res, {
        id: newsItem.id,
        title: newsItem.title,
        summary: newsItem.aiSummary,
        alreadyExists: true
      }, '이미 요약이 존재합니다.');
    }

    // AI 요약 생성
    try {
      const summary = await aiSummaryService.generateSummary(newsItem.content || newsItem.excerpt);
      
      // DB에 요약 저장
      const updatedNews = await prisma.news.update({
        where: { id },
        data: { aiSummary: summary }
      });

      return ResponseHelper.success(res, {
        id: updatedNews.id,
        title: updatedNews.title,
        summary: summary
      }, 'AI 요약이 성공적으로 생성되었습니다.');
    } catch (aiError) {
      console.error('AI 요약 생성 실패:', aiError);
      return ResponseHelper.internalServerError(res, 'AI 요약 생성 중 오류가 발생했습니다.');
    }
  } catch (error) {
    console.error('뉴스 요약 생성 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 요약 생성 중 오류가 발생했습니다.');
  }
}

/**
 * 새로운 뉴스 수집 작업 시작
 */
export async function createNewsCollection(req: Request, res: Response) {
  const { category, sources, maxItems = 50 } = req.body;
  
  try {
    // 뉴스 수집 실행
    let collectedNews;
    
    if (category) {
      collectedNews = await rssService.fetchNewsByCategory(category);
    } else if (sources && sources.length > 0) {
      collectedNews = await rssService.fetchNewsFromSources(sources);
    } else {
      collectedNews = await rssService.fetchAllNews();
    }

    // 중복 제거 및 제한
    const uniqueNews = rssService.deduplicateNews(collectedNews).slice(0, maxItems);
    
    // DB에 저장
    const savedCount = await newsRepository.saveNewsItems(uniqueNews);
    
    const result = {
      message: `뉴스 수집이 완료되었습니다.`,
      collected: uniqueNews.length,
      saved: savedCount,
      category: category || null,
      sources: sources || null,
      timestamp: new Date().toISOString()
    };

    return ResponseHelper.success(res, result);
  } catch (error) {
    console.error('뉴스 수집 작업 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 수집 작업 중 오류가 발생했습니다.');
  }
}

/**
 * 뉴스 수집 작업 상태 조회
 */
export async function getNewsCollections(req: Request, res: Response) {
  try {
    const {
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    // 최근 뉴스 수집 통계
    const recentCollections = await prisma.news.groupBy({
      by: ['source', 'category'],
      _count: {
        id: true
      },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 최근 24시간
        }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: limitNum,
      skip: (pageNum - 1) * limitNum
    });

    const collections = recentCollections.map(item => ({
      source: item.source,
      category: item.category,
      count: item._count.id,
      status: 'completed',
      lastUpdate: new Date().toISOString()
    }));

    return ResponseHelper.paginatedSuccess(
      res,
      collections,
      pageNum,
      limitNum,
      recentCollections.length
    );
  } catch (error) {
    console.error('뉴스 수집 작업 상태 조회 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 수집 작업 상태 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 뉴스 수집 작업 업데이트
 */
export async function updateNewsCollection(req: Request, res: Response) {
  const { id } = req.params;
  const { status, priority } = req.body;
  
  try {
    // 실제로는 뉴스 수집 작업 테이블이 있어야 하지만,
    // 현재는 간단히 응답만 반환
    const result = {
      id,
      status: status || 'updated',
      priority: priority || 'normal',
      updatedAt: new Date().toISOString(),
      message: '수집 작업이 업데이트되었습니다.'
    };

    return ResponseHelper.success(res, result);
  } catch (error) {
    console.error('뉴스 수집 작업 업데이트 중 오류 발생:', error);
    return ResponseHelper.internalServerError(res, '뉴스 수집 작업 업데이트 중 오류가 발생했습니다.');
  }
} 