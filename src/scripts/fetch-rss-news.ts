import { cleanupOldNews, fetchAndStoreAllCategories } from '../services/news/news-scheduler';

/**
 * RSS 뉴스를 가져오고 저장하는 메인 함수
 */
async function main() {
  try {
    console.log('RSS 뉴스 가져오기 및 저장 프로세스 시작...');
    
    // 오래된 뉴스 정리
    await cleanupOldNews();
    
    // 모든 카테고리의 뉴스 가져오기
    const results = await fetchAndStoreAllCategories();
    
    console.log('RSS 뉴스 가져오기 및 저장 프로세스 완료!');
    console.log('결과 요약:');
    console.table(results);
  } catch (error) {
    console.error('뉴스 가져오기 및 저장 프로세스 중 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main(); 