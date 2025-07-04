/**
 * RSS 피드에서 가져온 원본 뉴스 항목의 인터페이스
 */
export interface RawNewsItem {
  title: string;
  link: string;
  pubDate: string;
  creator?: string;
  content?: string;
  contentSnippet?: string;
  categories?: string[];
  isoDate?: string;
  guid?: string;
  // RSS 피드마다 다른 추가 필드들이 있을 수 있음
  [key: string]: any;
}

/**
 * 데이터베이스에 저장될 뉴스 항목 인터페이스
 */
export interface NewsItem {
  id?: string;
  title: string;
  url: string;
  source: string;
  sourceId: string;
  category: string;
  publishedAt: Date;
  excerpt: string;
  content?: string;
  imageUrl?: string;
  isProcessed: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * AI가 생성한 뉴스 요약 인터페이스
 */
export interface NewsSummary {
  id?: string;
  originalNewsIds: string[];
  category: string;
  title: string;
  summary: string;
  keywords: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * RSS 피드 소스 인터페이스
 */
export interface RssSource {
  id: string;
  name: string;
  url: string;
  category: string;
  language: string;
  isActive: boolean;
}

/**
 * 뉴스 필터링 옵션 인터페이스
 */
export interface NewsFilterOptions {
  categories?: string[];
  sources?: string[];
  keywords?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * 뉴스 통계 인터페이스
 */
export interface NewsStats {
  totalNews: number;
  newsByCategory: Record<string, number>;
  newsBySource: Record<string, number>;
  latestUpdate: Date;
}

/**
 * 번역된 뉴스 항목 인터페이스
 */
export interface TranslatedNewsItem extends NewsItem {
  originalTitle?: string;
  originalExcerpt?: string;
  originalContent?: string;
  translatedLang?: string;
}

/**
 * 번역 캐시 인터페이스
 */
export interface Translation {
  id: string;
  sourceText: string;
  targetLang: string;
  translatedText: string;
  usageCount: number;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 번역 통계 인터페이스
 */
export interface TranslationStats {
  totalTranslations: number;
  languageStats: {
    targetLang: string;
    _count: number;
    _avg: {
      usageCount: number;
    };
  }[];
  cacheHitRate?: number;
} 