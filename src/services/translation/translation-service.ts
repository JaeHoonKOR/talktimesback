import { prisma } from '../../server';
import { NewsItem, TranslatedNewsItem, Translation } from '../../types/news.types';

/**
 * 번역 서비스 클래스
 * Google Cloud Translate API를 사용하여 텍스트를 번역하고 PostgreSQL에 캐싱합니다.
 */
export class TranslationService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || '';
    this.apiUrl = 'https://translation.googleapis.com/language/translate/v2';
    
    if (!this.apiKey) {
      console.warn('⚠️ Google Translate API 키가 설정되지 않았습니다. 번역 기능이 제한됩니다.');
    }
  }

  /**
   * 캐시된 번역 조회
   */
  private async getCachedTranslation(sourceText: string, targetLang: string): Promise<Translation | null> {
    try {
      const cached = await prisma.translation.findUnique({
        where: {
          sourceText_targetLang: {
            sourceText,
            targetLang
          }
        }
      });

      if (cached) {
        // 사용 통계 업데이트
        try {
          await prisma.translation.update({
            where: { id: cached.id },
            data: {
              usageCount: { increment: 1 },
              lastUsedAt: new Date()
            }
          });
        } catch (updateError) {
          // 통계 업데이트 실패는 무시하고 캐시된 번역 반환
          console.warn('캐시 사용 통계 업데이트 실패:', updateError);
        }
      }

      return cached;
    } catch (error) {
      console.error('캐시 조회 중 오류:', error);
      return null; // 오류 발생 시 캐시 없음으로 처리
    }
  }

  /**
   * Google Translate API를 사용하여 텍스트 번역
   */
  private async translateWithAPI(text: string, targetLang: string): Promise<string> {
    if (!this.apiKey) {
      // API 키가 없는 경우 모의 번역 반환
      return `[${targetLang.toUpperCase()}] ${text}`;
    }

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          target: targetLang,
          source: 'ko'
        })
      });

      if (!response.ok) {
        throw new Error(`Google Translate API 오류: ${response.status}`);
      }

      const data = await response.json();
      return data.data.translations[0].translatedText;
    } catch (error) {
      console.error('Google Translate API 호출 실패:', error);
      // 실패 시 모의 번역 반환
      return `[${targetLang.toUpperCase()}] ${text}`;
    }
  }

  /**
   * 번역 결과를 캐시에 저장
   */
  private async saveTranslationToCache(
    sourceText: string, 
    targetLang: string, 
    translatedText: string
  ): Promise<void> {
    try {
      await prisma.translation.create({
        data: {
          sourceText,
          targetLang,
          translatedText
        }
      });
    } catch (error) {
      // 캐시 저장 실패는 로깅만 하고 무시 (번역 기능 자체는 계속 동작)
      console.warn('번역 캐시 저장 중 오류 (무시됨):', error);
    }
  }

  /**
   * 텍스트 번역 (캐시 우선)
   */
  async translateText(text: string, targetLang: string): Promise<string> {
    if (!text || text.trim() === '') {
      return text;
    }

    // 같은 언어인 경우 원본 반환
    if (targetLang === 'ko') {
      return text;
    }

    try {
      let translatedText: string;
      
      try {
        // 1. 캐시 확인 시도
        const cached = await this.getCachedTranslation(text, targetLang);
        if (cached) {
          console.log(`캐시에서 번역 조회: ${text.substring(0, 50)}...`);
          return cached.translatedText;
        }
      } catch (cacheError) {
        // 캐시 조회 실패는 무시하고 API 번역 진행
        console.warn('캐시 조회 실패, API 번역으로 진행:', cacheError);
      }

      // 2. 새로운 번역 수행
      console.log(`새로운 번역 수행: ${text.substring(0, 50)}...`);
      translatedText = await this.translateWithAPI(text, targetLang);

      // 3. 캐시에 저장 시도
      try {
        await this.saveTranslationToCache(text, targetLang, translatedText);
      } catch (saveError) {
        // 캐시 저장 실패는 무시
        console.warn('캐시 저장 실패 (무시됨):', saveError);
      }

      return translatedText;
    } catch (error) {
      console.error('번역 중 오류 발생:', error);
      return text; // 실패 시 원본 텍스트 반환
    }
  }

  /**
   * 뉴스 항목 번역
   */
  async translateNews(newsId: string, targetLang: string): Promise<TranslatedNewsItem | null> {
    try {
      const news = await prisma.news.findUnique({
        where: { id: newsId }
      });

      if (!news) {
        throw new Error('뉴스를 찾을 수 없습니다.');
      }

      // 같은 언어인 경우 원본 반환
      if (targetLang === 'ko') {
        return news as TranslatedNewsItem;
      }

      // 제목과 요약 번역
      const [translatedTitle, translatedExcerpt] = await Promise.all([
        this.translateText(news.title, targetLang),
        this.translateText(news.excerpt, targetLang)
      ]);

      // 본문이 있는 경우 번역
      let translatedContent: string | undefined;
      if (news.content) {
        translatedContent = await this.translateText(news.content, targetLang);
      }

      return {
        ...news,
        title: translatedTitle,
        excerpt: translatedExcerpt,
        content: translatedContent,
        originalTitle: news.title,
        originalExcerpt: news.excerpt,
        originalContent: news.content || undefined,
        translatedLang: targetLang
      };
    } catch (error) {
      console.error('뉴스 번역 중 오류:', error);
      return null;
    }
  }

  /**
   * 배치 번역 처리
   */
  async translateBatch(texts: string[], targetLang: string): Promise<string[]> {
    try {
      // 1. 캐시된 번역 먼저 조회
      const cacheResults = await prisma.translation.findMany({
        where: {
          sourceText: { in: texts },
          targetLang
        }
      });

      // 2. 캐시되지 않은 텍스트만 추출
      const cachedMap = new Map(cacheResults.map(r => [r.sourceText, r.translatedText]));
      const uncachedTexts = texts.filter(text => !cachedMap.has(text));

      // 3. 새로운 번역 수행
      const newTranslations = await Promise.all(
        uncachedTexts.map(text => this.translateText(text, targetLang))
      );

      // 4. 결과 조합
      return texts.map(text => {
        const cached = cachedMap.get(text);
        if (cached) return cached;
        
        const index = uncachedTexts.indexOf(text);
        return index >= 0 ? newTranslations[index] : text;
      });
    } catch (error) {
      console.error('배치 번역 중 오류:', error);
      return texts; // 실패 시 원본 텍스트 배열 반환
    }
  }

  /**
   * 사용자 언어 설정에 따른 뉴스 목록 번역
   */
  async translateNewsList(newsList: NewsItem[], targetLang: string): Promise<TranslatedNewsItem[]> {
    if (targetLang === 'ko') {
      return newsList as TranslatedNewsItem[];
    }

    try {
      const translatedNews = await Promise.all(
        newsList.map(async (news) => {
          const [translatedTitle, translatedExcerpt] = await Promise.all([
            this.translateText(news.title, targetLang),
            this.translateText(news.excerpt, targetLang)
          ]);

          return {
            ...news,
            title: translatedTitle,
            excerpt: translatedExcerpt,
            originalTitle: news.title,
            originalExcerpt: news.excerpt,
            translatedLang: targetLang
          } as TranslatedNewsItem;
        })
      );

      return translatedNews;
    } catch (error) {
      console.error('뉴스 목록 번역 중 오류:', error);
      return newsList as TranslatedNewsItem[];
    }
  }
} 