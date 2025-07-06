import { NextFunction, Request, Response } from 'express';
import { prisma } from '../server';
import { serverLogger } from '../utils/logger';
import { ResponseHelper } from '../utils/response.helper';

/**
 * 통합 뉴스 목록 조회 (검색, 필터링, 개인화 지원)
 * cursor-based 페이지네이션 적용
 */
export const getNewsUnified = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      search, 
      category, 
      sort = 'latest',
      personalized = 'false',
      cursor,
      limit = '20' 
    } = req.query;

    const userId = req.user?.id;
    const pageSize = parseInt(limit as string);

    let whereClause: any = {};
    let orderBy: any = {};
    let cursorObj: any = undefined;

    // 검색 조건 추가
    if (search) {
      whereClause = {
        OR: [
          { title: { contains: search as string, mode: 'insensitive' } },
          { excerpt: { contains: search as string, mode: 'insensitive' } }
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

    // 개인화 뉴스 처리
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

    // 커서 기반 페이지네이션 설정
    if (cursor) {
      try {
        // 커서 디코딩 (Base64 -> JSON)
        const decodedCursor = Buffer.from(cursor as string, 'base64').toString('utf-8');
        const cursorData = JSON.parse(decodedCursor);
        
        // 정렬 기준에 따라 커서 객체 생성
        if (sort === 'latest' || sort === 'relevance') {
          cursorObj = {
            publishedAt: new Date(cursorData.publishedAt),
            id: cursorData.id
          };
          whereClause = {
            ...whereClause,
            OR: [
              {
                publishedAt: { lt: new Date(cursorData.publishedAt) }
              },
              {
                publishedAt: new Date(cursorData.publishedAt),
                id: { lt: cursorData.id }
              }
            ]
          };
        } else if (sort === 'popular') {
          cursorObj = {
            viewCount: cursorData.viewCount,
            id: cursorData.id
          };
          whereClause = {
            ...whereClause,
            OR: [
              {
                viewCount: { lt: cursorData.viewCount }
              },
              {
                viewCount: cursorData.viewCount,
                id: { lt: cursorData.id }
              }
            ]
          };
        }
      } catch (error) {
        serverLogger.warn('커서 디코딩 실패', { cursor, error });
        // 커서 파싱 실패 시 무시하고 첫 페이지 반환
      }
    }

    // 뉴스 조회 (커서 기반 페이지네이션)
    const newsList = await prisma.news.findMany({
      where: whereClause,
      orderBy: [orderBy, { id: 'desc' }], // 항상 고유한 정렬을 위해 ID 추가
      take: pageSize + 1, // 다음 페이지 확인을 위해 1개 더 가져옴
      cursor: cursorObj ? { id: cursorObj.id } : undefined,
      select: {
        id: true,
        title: true,
        url: true,
        source: true,
        category: true,
        publishedAt: true,
        excerpt: true,
        content: false, // 목록에서는 내용 제외하여 성능 최적화
        imageUrl: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // 다음 페이지 존재 여부 확인
    const hasNextPage = newsList.length > pageSize;
    const items = hasNextPage ? newsList.slice(0, pageSize) : newsList;
    
    // 다음 커서 생성
    let nextCursor = null;
    if (hasNextPage && items.length > 0) {
      const lastItem = items[items.length - 1];
      const cursorData = {
        id: lastItem.id,
        publishedAt: lastItem.publishedAt.toISOString(),
        viewCount: (lastItem as any).viewCount || 0
      };
      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }
    
    return ResponseHelper.success(res, {
      news: items,
      pagination: {
        nextCursor,
        hasNextPage,
        count: items.length
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
      where: { id },
      select: {
        id: true,
        title: true,
        url: true,
        source: true,
        category: true,
        publishedAt: true,
        excerpt: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!news) {
      return ResponseHelper.notFound(res, '뉴스를 찾을 수 없습니다.');
    }

    // AI 요약이 없는 경우 기본 설명 반환
    const summary = news.excerpt || news.content?.substring(0, 200) + '...';

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
      where: { id },
      select: {
        id: true,
        title: true,
        url: true,
        source: true,
        category: true,
        publishedAt: true,
        excerpt: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true
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
      url: news.url,
      source: news.source,
      category: news.category,
      publishedAt: news.publishedAt,
      excerpt: news.excerpt,
      content: news.content,
      imageUrl: news.imageUrl,
      language: lang,
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
 * 뉴스 통계 정보 조회
 */
export const getNewsStatistics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalCount, categoryStats, sourceStats, lastUpdated] = await Promise.all([
      prisma.news.count(),
      prisma.news.groupBy({
        by: ['category'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      }),
      prisma.news.groupBy({
        by: ['source'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10 // 상위 10개만
      }),
      prisma.news.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })
    ]);

    return ResponseHelper.success(res, {
      totalCount,
      categoryCounts: categoryStats.map(stat => ({
        category: stat.category,
        count: stat._count.id
      })),
      topSources: sourceStats.map(stat => ({
        source: stat.source,
        count: stat._count.id
      })),
      lastUpdated: lastUpdated?.createdAt
    });

  } catch (error) {
    serverLogger.error('뉴스 통계 조회 중 오류 발생', error as Error);
    return ResponseHelper.internalServerError(res);
  }
}; 