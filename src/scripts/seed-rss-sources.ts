import { PrismaClient } from '@prisma/client';
import { RSS_SOURCES } from '../services/news/rss-sources';

const prisma = new PrismaClient();

/**
 * RSS 소스 정보를 데이터베이스에 저장하는 함수
 */
async function seedRssSources() {
  try {
    console.log('RSS 소스 정보를 데이터베이스에 저장합니다...');
    
    // 기존 소스 정보 초기화 (선택적)
    // await prisma.newsSource.deleteMany({});
    
    // 각 RSS 소스를 순회하며 데이터베이스에 저장
    for (const source of RSS_SOURCES) {
      // 이미 존재하는지 확인
      const existingSource = await prisma.newsSource.findFirst({
        where: {
          name: source.name,
          url: source.url,
        },
      });
      
      if (existingSource) {
        // 이미 존재하는 경우 업데이트
        await prisma.newsSource.update({
          where: { id: existingSource.id },
          data: {
            url: source.url,
            category: source.category,
            type: 'rss',
            active: source.isActive,
          },
        });
        console.log(`${source.name} 소스 정보를 업데이트했습니다.`);
      } else {
        // 존재하지 않는 경우 새로 생성
        await prisma.newsSource.create({
          data: {
            name: source.name,
            url: source.url,
            category: source.category,
            type: 'rss',
            active: source.isActive,
          },
        });
        console.log(`${source.name} 소스 정보를 추가했습니다.`);
      }
    }
    
    console.log('RSS 소스 정보 저장 완료!');
  } catch (error) {
    console.error('RSS 소스 정보 저장 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
seedRssSources(); 