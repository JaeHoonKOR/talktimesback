import { PrismaClient } from '@prisma/client';
import { prisma } from '../../server';
import { NewsFilterOptions, NewsItem, NewsStats } from '../../types/news.types';

const prismaClient = new PrismaClient();

/**
 * Prisma null 값을 undefined로 변환하는 헬퍼 함수
 */
function convertPrismaToNewsItem(prismaItem: any): NewsItem {
  return {
    ...prismaItem,
    content: prismaItem.content || undefined,
    imageUrl: prismaItem.imageUrl || undefined,
    aiSummary: prismaItem.aiSummary || undefined
  };
}

/**
 * 단일 뉴스 항목 저장
 */
export async function saveNewsItem(newsItem: NewsItem): Promise<NewsItem> {
  const result = await prisma.news.create({
    data: {
      id: newsItem.id,
      title: newsItem.title,
      url: newsItem.url,
      source: newsItem.source,
      sourceId: newsItem.sourceId, 
      category: newsItem.category,
      publishedAt: newsItem.publishedAt,
      excerpt: newsItem.excerpt,
      content: newsItem.content || '',
      imageUrl: newsItem.imageUrl || null,
      isProcessed: newsItem.isProcessed,
    },
  });

  return {
    id: result.id,
    title: result.title,
    url: result.url,
    source: result.source,
    sourceId: result.sourceId,
    category: result.category,
    publishedAt: result.publishedAt,
    excerpt: result.excerpt,
    content: result.content || undefined,
    imageUrl: result.imageUrl || undefined,
    isProcessed: result.isProcessed,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

/**
 * 여러 뉴스 항목 저장 (중복 방지)
 */
export async function saveNewsItems(newsItems: NewsItem[]): Promise<number> {
  let savedCount = 0;

  for (const item of newsItems) {
    // URL로 기존 항목 확인
    const existingItem = await prisma.news.findFirst({
      where: {
        url: item.url,
      },
    });

    if (!existingItem) {
      await saveNewsItem(item);
      savedCount++;
    }
  }

  return savedCount;
}

/**
 * 뉴스 항목 ID로 가져오기
 */
export async function getNewsById(id: string): Promise<NewsItem | null> {
  const newsItem = await prisma.news.findUnique({
    where: { id }
  });

  if (!newsItem) return null;

  return {
    ...newsItem,
    content: newsItem.content || undefined,
    imageUrl: newsItem.imageUrl || undefined,
    aiSummary: newsItem.aiSummary || undefined
  };
}

/**
 * 필터 조건에 맞는 뉴스 목록 가져오기
 */
export async function getNewsItems(options: NewsFilterOptions): Promise<NewsItem[]> {
  const {
    categories,
    sources,
    keywords,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  // 필터 조건 구성
  const where: any = {};

  if (categories && categories.length > 0) {
    where.category = { in: categories };
  }

  if (sources && sources.length > 0) {
    where.sourceId = { in: sources };
  }

  if (keywords && keywords.length > 0) {
    where.OR = keywords.map(keyword => ({
      OR: [
        { title: { contains: keyword, mode: 'insensitive' } },
        { excerpt: { contains: keyword, mode: 'insensitive' } },
        { content: { contains: keyword, mode: 'insensitive' } },
      ],
    }));
  }

  if (startDate || endDate) {
    where.publishedAt = {};
    if (startDate) {
      where.publishedAt.gte = startDate;
    }
    if (endDate) {
      where.publishedAt.lte = endDate;
    }
  }

  // 데이터 조회
  const newsItems = await prisma.news.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    skip: offset,
    take: limit
  });
  
  // null을 undefined로 변환
  return newsItems.map(convertPrismaToNewsItem);
}

/**
 * 카테고리별 최신 뉴스 가져오기
 */
export async function getLatestNewsByCategory(category: string, limit = 10): Promise<NewsItem[]> {
  const newsItems = await prisma.news.findMany({
    where: { category },
    orderBy: { publishedAt: 'desc' },
    take: limit
  });
  
  return newsItems.map(convertPrismaToNewsItem);
}

/**
 * 뉴스 처리 상태 업데이트
 */
export async function updateNewsProcessingStatus(newsId: string, isProcessed: boolean): Promise<void> {
  try {
    await prisma.news.update({
      where: { id: newsId },
      data: { isProcessed }
    });
  } catch (error) {
    console.error('뉴스 처리 상태 업데이트 중 오류:', error);
    throw error;
  }
}

/**
 * 처리되지 않은 뉴스 항목 조회
 */
export async function getUnprocessedNewsItems(limit: number = 20): Promise<NewsItem[]> {
  try {
    const newsItems = await prisma.news.findMany({
      where: { isProcessed: false },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    
    return newsItems.map(convertPrismaToNewsItem);
  } catch (error) {
    console.error('처리되지 않은 뉴스 조회 중 오류:', error);
    return [];
  }
}

/**
 * 뉴스 통계 가져오기
 */
export async function getNewsStats(): Promise<NewsStats> {
  const totalNews = await prisma.news.count();
  
  // 카테고리별 통계
  const categoryStats = await prisma.news.groupBy({
    by: ['category'],
    _count: { id: true },
  });
  
  // 소스별 통계
  const sourceStats = await prisma.news.groupBy({
    by: ['source'],
    _count: { id: true },
  });
  
  // 최신 업데이트 시간
  const latestNews = await prisma.news.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  
  const newsByCategory = Object.fromEntries(
    categoryStats.map(stat => [stat.category, stat._count.id])
  );
  
  const newsBySource = Object.fromEntries(
    sourceStats.map(stat => [stat.source, stat._count.id])
  );
  
  return {
    totalNews,
    newsByCategory,
    newsBySource,
    latestUpdate: latestNews?.createdAt || new Date(),
  };
}

export async function createNewsItem(newsData: any): Promise<NewsItem> {
  const newsItem = await prisma.news.create({
    data: newsData
  });
  
  return convertPrismaToNewsItem(newsItem);
}

export async function getNewsByCategory(category: string): Promise<NewsItem[]> {
  const newsItems = await prisma.news.findMany({
    where: { category },
    orderBy: { publishedAt: 'desc' },
    take: 50
  });
  
  return newsItems.map(convertPrismaToNewsItem);
}

export async function getLatestNews(limit: number = 20): Promise<NewsItem[]> {
  const newsItems = await prisma.news.findMany({
    orderBy: { publishedAt: 'desc' },
    take: limit
  });
  
  return newsItems.map(convertPrismaToNewsItem);
}

async function findById(id: string): Promise<NewsItem | null> {
  const newsItem = await prisma.news.findUnique({
    where: { id }
  });

  if (!newsItem) {
    return null;
  }

  return convertPrismaToNewsItem(newsItem);
}

async function findMany(options: NewsFilterOptions = {}): Promise<NewsItem[]> {
  const { categories, sources, keywords, startDate, endDate, limit = 20, offset = 0 } = options;

  const whereClause: any = {};

  if (categories && categories.length > 0) {
    whereClause.category = { in: categories };
  }

  if (sources && sources.length > 0) {
    whereClause.source = { in: sources };
  }

  if (keywords && keywords.length > 0) {
    whereClause.OR = keywords.map(keyword => ({
      OR: [
        { title: { contains: keyword, mode: 'insensitive' } },
        { excerpt: { contains: keyword, mode: 'insensitive' } }
      ]
    }));
  }

  if (startDate || endDate) {
    whereClause.publishedAt = {};
    if (startDate) whereClause.publishedAt.gte = startDate;
    if (endDate) whereClause.publishedAt.lte = endDate;
  }

  const newsItems = await prisma.news.findMany({
    where: whereClause,
    orderBy: { publishedAt: 'desc' },
    take: limit,
    skip: offset
  });

  return newsItems.map(convertPrismaToNewsItem);
} 