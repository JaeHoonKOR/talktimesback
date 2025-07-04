import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { NewsItem, NewsSummary } from '../../types/news.types';
import * as newsRepo from './news-repository';

// OpenAI API 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 단일 뉴스를 요약하는 함수
 */
export async function summarizeNewsItem(newsItem: NewsItem): Promise<string> {
  if (!newsItem.content) {
    return newsItem.excerpt;
  }

  try {
    const contentToSummarize = newsItem.content.length > 8000 
      ? newsItem.content.slice(0, 8000) 
      : newsItem.content;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '당신은 전문적인 뉴스 요약 도우미입니다. 주어진 뉴스 콘텐츠를 명확하고 간결하게 요약해주세요. 요약은 객관적이고 중립적이어야 합니다. 원문의 핵심 정보와 주요 포인트를 놓치지 마세요. 200자 이내로 요약해주세요.',
        },
        {
          role: 'user',
          content: `다음 뉴스 내용을 200자 이내로 요약해주세요:\n\n제목: ${newsItem.title}\n\n${contentToSummarize}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.5,
    });

    const summary = response.choices[0]?.message?.content?.trim() || newsItem.excerpt;
    
    // 뉴스 처리 상태 업데이트
    await newsRepo.updateNewsProcessingStatus(newsItem.id!, true);
    
    return summary;
  } catch (error) {
    console.error('뉴스 요약 중 오류 발생:', error);
    return newsItem.excerpt;
  }
}

/**
 * 여러 뉴스 항목을 요약하고 하나의 통합 요약 생성
 */
export async function createSummaryFromNews(
  newsItems: NewsItem[],
  category: string,
): Promise<NewsSummary> {
  if (newsItems.length === 0) {
    throw new Error('요약할 뉴스가 없습니다.');
  }

  const newsContents = newsItems.map(
    (item) => `제목: ${item.title}\n내용: ${item.excerpt}\n출처: ${item.source}\n`
  ).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '당신은 전문적인 뉴스 요약 도우미입니다. 여러 뉴스 기사의 내용을 종합하여 중요한 트렌드와 연관성을 파악해 통합 요약을 생성해주세요. 요약은 객관적이고 간결해야 합니다. 핵심 키워드 5개도 추출해주세요.',
        },
        {
          role: 'user',
          content: `다음 ${category} 관련 뉴스들을 읽고 통합 요약과 관련 키워드 5개를 추출해주세요:\n\n${newsContents}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    const result = response.choices[0]?.message?.content?.trim() || '';
    
    // 요약과 키워드 분리 (형식: "요약: ... \n\n키워드: 키워드1, 키워드2, ...")
    let summary = result;
    let keywords: string[] = [];
    
    const keywordMatch = result.match(/키워드(?:\s*|:\s*)([^]*)/i);
    if (keywordMatch) {
      // 키워드 부분 추출
      const keywordText = keywordMatch[1].trim();
      keywords = keywordText.split(/,|、|，|\n/).map(k => k.trim()).filter(Boolean);
      
      // 요약 부분만 추출 (키워드 부분 제외)
      summary = result.substring(0, result.indexOf(keywordMatch[0])).trim();
    }
    
    // 뉴스 처리 상태 업데이트
    await Promise.all(
      newsItems.map((item) => 
        item.id ? newsRepo.updateNewsProcessingStatus(item.id, true) : Promise.resolve()
      )
    );
    
    // 제목 생성
    const titleResponse = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '다음 뉴스 요약에 적합한 간결하고 매력적인 제목(20자 이내)을 만들어주세요.',
        },
        {
          role: 'user',
          content: summary,
        },
      ],
      max_tokens: 50,
      temperature: 0.7,
    });
    
    const title = titleResponse.choices[0]?.message?.content?.trim() || 
      `${category} 뉴스 요약`;
    
    return {
      id: uuidv4(),
      originalNewsIds: newsItems.filter(item => item.id).map(item => item.id!) || [],
      category,
      title,
      summary,
      keywords: keywords.length > 0 ? keywords : ['뉴스', category],
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('통합 뉴스 요약 생성 중 오류 발생:', error);
    
    // 오류 발생 시 기본 요약 반환
    return {
      id: uuidv4(),
      originalNewsIds: newsItems.filter(item => item.id).map(item => item.id!) || [],
      category,
      title: `${category} 주요 뉴스`,
      summary: newsItems.map(item => item.title).join('\n'),
      keywords: [category],
      createdAt: new Date(),
    };
  }
}

/**
 * 처리되지 않은 뉴스 항목들을 일괄 요약
 */
export async function batchProcessUnprocessedNews(limit = 20): Promise<number> {
  const unprocessedNews = await newsRepo.getUnprocessedNewsItems(limit);
  
  if (unprocessedNews.length === 0) {
    return 0;
  }
  
  // 카테고리별로 뉴스 그룹화
  const newsByCategory: Record<string, NewsItem[]> = {};
  
  unprocessedNews.forEach(item => {
    if (!newsByCategory[item.category]) {
      newsByCategory[item.category] = [];
    }
    newsByCategory[item.category].push(item);
  });
  
  let processedCount = 0;
  
  // 카테고리별로 처리
  for (const [category, items] of Object.entries(newsByCategory)) {
    if (items.length > 0) {
      try {
        // 각 카테고리별로 통합 요약 생성
        await createSummaryFromNews(items, category);
        processedCount += items.length;
      } catch (error) {
        console.error(`${category} 뉴스 일괄 처리 중 오류 발생:`, error);
      }
    }
  }
  
  return processedCount;
} 