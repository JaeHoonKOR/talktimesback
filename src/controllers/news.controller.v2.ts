import { NextFunction, Request, Response } from 'express';
import { prisma } from '../server';
import { serverLogger } from '../utils/logger';
import { ResponseHelper } from '../utils/response.helper';

/**
 * 통합 뉴스 목록 조회 (검색, 필터링, 개인화 지원)
 */
export const getNewsUnified = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      search, 
      category, 
      sort = 'latest', 
      personalized = 'false',
      page = 1, 
      limit = 20 
    } = req.query;

    const userId = req.user?.id;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let whereClause: any = {};
    let orderBy: any = {};

    // 검색 조건 추가
    if (search) {
      whereClause = {
        OR: [
          { title: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } }
        ]
      };
    }

    // 카테고리 필터링
    if (category) {
      whereClause.category = category;
    }

    // 정렬 조건
    switch (sort) {
      case 'latest':
        orderBy = { publishedAt: 'desc' };
        break;
      case 'popular':
        orderBy = { viewCount: 'desc' };
        break;
      case 'relevance':
        orderBy = { publishedAt: 'desc' };
        break;
      default:
        orderBy = { publishedAt: 'desc' };
    }

    // 개인화 뉴스 처리 (추후 구현)
    if (personalized === 'true' && userId) {
      // 사용자 관심사 기반 뉴스 필터링 로직
      const userKeywords = await prisma.keyword.findMany({
        where: { userId: parseInt(userId) },
        select: { keyword: true }
      });

      if (userKeywords.length > 0) {
        const keywords = userKeywords.map(k => k.keyword);
        whereClause.OR = [
          ...(whereClause.OR || []),
          ...keywords.map(keyword => ({
            title: { contains: keyword, mode: 'insensitive' }
          }))
        ];
      }
    }

    const [newsList, totalCount] = await Promise.all([
      prisma.news.findMany({
        where: whereClause,
        orderBy,
        skip: offset,
        take: parseInt(limit as string),
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          imageUrl: true,
          publishedAt: true,
          source: true,
          viewCount: true,
          createdAt: true
        }
      }),
      prisma.news.count({ where: whereClause })
    ]);

    const hasMore = offset + newsList.length < totalCount;
    
    return ResponseHelper.success(res, {
      news: newsList,
      pagination: {
        currentPage: parseInt(page as string),
        totalPages: Math.ceil(totalCount / parseInt(limit as string)),
        totalCount,
        hasMore
      },
      filters: {
        search,
        category,
        sort,
        personalized: personalized === 'true' && !!userId
      }
    });

  } catch (error) {
    serverLogger.error('뉴스 목록 조회 중 오류 발생', error as Error);
    return ResponseHelper.internalServerError(res);
  }
};

/**
 * 뉴스 요약 조회
 */
export const getNewsSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const news = await prisma.news.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        aiSummary: true,
        createdAt: true,
        publishedAt: true
      }
    });

    if (!news) {
      return ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
    }

    // AI 요약이 없는 경우 기본 설명 반환
    const summary = news.aiSummary || news.description || news.content?.substring(0, 200) + '...';

    return ResponseHelper.success(res, {
      id: news.id,
      title: news.title,
      summary,
      publishedAt: news.publishedAt,
      createdAt: news.createdAt
    });

  } catch (error) {
    serverLogger.error('뉴스 요약 조회 중 오류 발생', error as Error);
    return ResponseHelper.internalServerError(res);
  }
};

/**
 * 뉴스 번역 조회
 */
export const getNewsTranslation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, lang } = req.params;

    const news = await prisma.news.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        publishedAt: true
      }
    });

    if (!news) {
      return ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
    }

    // 번역 캐시 확인 (추후 구현)
    // const translationCache = await getTranslationCache(news.id, lang);
    
    // 임시로 원본 데이터 반환
    return ResponseHelper.success(res, {
      id: news.id,
      title: news.title,
      description: news.description,
      content: news.content,
      language: lang,
      publishedAt: news.publishedAt,
      translated: false // 실제 번역 구현 시 true로 변경
    });

  } catch (error) {
    serverLogger.error('뉴스 번역 조회 중 오류 발생', error as Error);
    return ResponseHelper.internalServerError(res);
  }
};

/**
 * 뉴스 소스 목록 조회
 */
export const getNewsSources = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sources = await prisma.news.groupBy({
      by: ['source'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    return ResponseHelper.success(res, {
      sources: sources.map(source => ({
        name: source.source,
        count: source._count.id
      }))
    });

  } catch (error) {
    serverLogger.error('뉴스 소스 조회 중 오류 발생', error as Error);
    return ResponseHelper.internalServerError(res);
  }
};

/**
 * 뉴스 카테고리 목록 조회
 */
export const getNewsCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.news.groupBy({
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

    return ResponseHelper.success(res, {
      categories: categories.map(category => ({
        name: category.category,
        count: category._count.id
      }))
    });

  } catch (error) {
    serverLogger.error('뉴스 카테고리 조회 중 오류 발생', error as Error);
    return ResponseHelper.internalServerError(res);
  }
};

/**
 * 뉴스 통계 조회
 */
export const getNewsStatistics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalNews, todayNews, categoryStat, sourceStat] = await Promise.all([
      prisma.news.count(),
      prisma.news.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.news.groupBy({
        by: ['category'],
        _count: { id: true }
      }),
      prisma.news.groupBy({
        by: ['source'],
        _count: { id: true }
      })
    ]);

    return ResponseHelper.success(res, {
      totalNews,
      todayNews,
      categories: categoryStat.map(c => ({
        name: c.category,
        count: c._count.id
      })),
      sources: sourceStat.map(s => ({
        name: s.source,
        count: s._count.id
      }))
    });

  } catch (error) {
    serverLogger.error('뉴스 통계 조회 중 오류 발생', error as Error);
    return ResponseHelper.internalServerError(res);
  }
}; 