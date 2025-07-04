import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { v4 as uuidv4 } from 'uuid';
import { NewsItem, RawNewsItem } from '../../types/news.types';
import { VERBOSE_LOGGING } from './news-cron';
import { getActiveRssSources, getRssSourceById, getRssSourcesByCategory } from './rss-sources';

// RSS Parser 인스턴스 생성 및 사용자 정의 필드 추가
const parser = new Parser({
  customFields: {
    item: [
      'media:content',
      'media:thumbnail',
      'content:encoded',
      'dc:creator',
      'enclosure',
    ],
  },
});

/**
 * 특정 RSS 소스에서 뉴스 항목을 가져오는 함수
 */
export async function fetchNewsFromSource(sourceId: string): Promise<NewsItem[]> {
  const source = getRssSourceById(sourceId);
  if (!source) {
    throw new Error(`소스 ID ${sourceId}를 찾을 수 없습니다.`);
  }

  try {
    console.log(`🔍 ${source.name} 소스에서 뉴스 가져오는 중...`);
    const feed = await parser.parseURL(source.url);
    
    console.log(`📋 ${source.name}에서 ${feed.items.length}개의 항목 발견`);
    
    // 가져온 RSS 항목을 NewsItem 형식으로 변환
    const newsItems: NewsItem[] = await Promise.all(
      feed.items.map(async (item: any) => {
        // 본문에서 이미지 URL 추출 시도
        let imageUrl = await extractImageFromContent(item);
        
        // 날짜 처리 개선 - 유효하지 않은 날짜인 경우 현재 시간으로 설정
        let publishedAt;
        try {
          publishedAt = new Date(item.isoDate || item.pubDate);
          // 날짜가 유효하지 않은 경우 현재 시간 사용
          if (isNaN(publishedAt.getTime())) {
            publishedAt = new Date();
            if (VERBOSE_LOGGING) {
              console.log(`유효하지 않은 날짜 필드를 현재 시간으로 대체: ${item.title}`);
            }
          }
        } catch (error) {
          publishedAt = new Date();
          if (VERBOSE_LOGGING) {
            console.log(`날짜 파싱 오류, 현재 시간으로 대체: ${item.title}`);
          }
        }
        
        return {
          id: uuidv4(),
          title: item.title,
          url: item.link,
          source: source.name,
          sourceId: source.id,
          category: source.category,
          publishedAt,
          excerpt: item.contentSnippet
            ? item.contentSnippet.substring(0, 300)
            : '',
          content: item.content || item['content:encoded'] || '',
          imageUrl,
          isProcessed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      })
    );

    console.log(`✅ ${source.name}에서 ${newsItems.length}개의 뉴스 항목 처리 완료`);
    return newsItems;
  } catch (error) {
    console.error(`❌ ${source.name}에서 뉴스를 가져오는 중 오류 발생:`, error);
    return [];
  }
}

/**
 * 특정 카테고리의 모든 소스에서 뉴스를 가져오는 함수
 */
export async function fetchNewsByCategory(category: string): Promise<NewsItem[]> {
  const sources = getRssSourcesByCategory(category);
  console.log(`📊 ${category} 카테고리에서 ${sources.length}개의 소스를 확인했습니다.`);
  
  const allNewsPromises = sources.map((source) => fetchNewsFromSource(source.id));
  
  console.log(`⏳ ${category} 카테고리의 모든 소스에서 뉴스를 가져오는 중...`);
  const results = await Promise.allSettled(allNewsPromises);
  
  // 성공적으로 가져온 결과만 필터링하여 합침
  const newsItems = results
    .filter((result): result is PromiseFulfilledResult<NewsItem[]> => result.status === 'fulfilled')
    .flatMap((result) => result.value);
  
  const failedCount = results.filter(result => result.status === 'rejected').length;
  console.log(`✅ ${category} 카테고리에서 총 ${newsItems.length}개의 뉴스 항목을 가져왔습니다.`);
  if (failedCount > 0) {
    console.log(`⚠️ ${failedCount}개의 소스에서 오류가 발생했습니다.`);
  }
  
  return newsItems;
}

/**
 * 모든 활성 소스에서 뉴스를 가져오는 함수
 */
export async function fetchAllNews(): Promise<NewsItem[]> {
  const sources = getActiveRssSources();
  console.log(`📊 총 ${sources.length}개의 활성 RSS 소스가 있습니다.`);
  
  // 소스별로 병렬 처리하되, 각 소스에 대한 에러는 개별적으로 처리
  const allNewsPromises = sources.map((source) => fetchNewsFromSource(source.id));
  
  console.log(`⏳ 모든 소스에서 뉴스를 가져오는 중...`);
  const results = await Promise.allSettled(allNewsPromises);
  
  // 성공적으로 가져온 결과만 필터링하여 합침
  const newsItems = results
    .filter((result): result is PromiseFulfilledResult<NewsItem[]> => result.status === 'fulfilled')
    .flatMap((result) => result.value);
  
  const failedCount = results.filter(result => result.status === 'rejected').length;
  console.log(`✅ 총 ${newsItems.length}개의 뉴스 항목을 가져왔습니다.`);
  if (failedCount > 0) {
    console.log(`⚠️ ${failedCount}개의 소스에서 오류가 발생했습니다.`);
  }
  
  return newsItems;
}

/**
 * 뉴스 콘텐츠에서 이미지 URL을 추출하는 함수
 */
async function extractImageFromContent(item: RawNewsItem): Promise<string | undefined> {
  try {
    // 1. media:content 또는 media:thumbnail에서 이미지 URL 확인
    if (item['media:content'] && item['media:content'].$.url) {
      return item['media:content'].$.url;
    }
    
    if (item['media:thumbnail'] && item['media:thumbnail'].$.url) {
      return item['media:thumbnail'].$.url;
    }
    
    // 2. enclosure에서 이미지 URL 확인
    if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url;
    }
    
    // 3. 콘텐츠에서 이미지 태그 추출
    const content = item.content || item['content:encoded'] || '';
    if (content) {
      const $ = cheerio.load(content);
      const firstImage = $('img').first();
      if (firstImage.length > 0 && firstImage.attr('src')) {
        return firstImage.attr('src');
      }
    }
    
    // 4. Reddit 처리 - URL에 직접 접근하지 않음
    if (item.link && item.link.includes('reddit.com')) {
      // Reddit 게시물에는 기본 이미지 사용
      return 'https://www.redditstatic.com/icon.png';
    }
    
    // 5. 일부 사이트에서만 선택적으로 URL 스크래핑 시도
    if (item.link && 
        !item.link.includes('reddit.com') && 
        !item.link.includes('cnbc.com')) { // 문제 사이트 제외
      try {
        const response = await axios.get(item.link, { 
          timeout: 3000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        const $ = cheerio.load(response.data);
        
        // Open Graph 이미지 태그 확인
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) {
          return ogImage;
        }
        
        // Twitter 카드 이미지 확인
        const twitterImage = $('meta[name="twitter:image"]').attr('content');
        if (twitterImage) {
          return twitterImage;
        }
        
        // 첫 번째 이미지 확인
        const firstImage = $('img').first();
        if (firstImage.length > 0 && firstImage.attr('src')) {
          return firstImage.attr('src');
        }
      } catch (error) {
        // 조용히 실패 처리 - 에러 로그만 최소화
        return undefined;
      }
    }
  } catch (error) {
    // 전체 함수 실패 시 조용히 실패 처리
    return undefined;
  }
  
  return undefined;
}

/**
 * 뉴스 항목 중복 제거 함수
 */
export function deduplicateNews(newsItems: NewsItem[]): NewsItem[] {
  console.log(`🔍 ${newsItems.length}개의 뉴스 항목에서 중복 제거 중...`);
  
  const unique = new Map<string, NewsItem>();
  
  for (const item of newsItems) {
    const key = item.title.toLowerCase().trim();
    if (!unique.has(key) || new Date(item.publishedAt) > new Date(unique.get(key)!.publishedAt)) {
      unique.set(key, item);
    }
  }
  
  const result = Array.from(unique.values());
  console.log(`✅ 중복 제거 완료: ${newsItems.length}개 → ${result.length}개`);
  
  return result;
} 