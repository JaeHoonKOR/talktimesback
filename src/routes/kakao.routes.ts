import { PrismaClient } from '@prisma/client';
import { Router } from 'express';

const router = Router();
const prisma = new PrismaClient();

/**
 * 카카오톡 챗봇 콜백 처리
 * 카카오톡 스킬 서버로부터 받는 요청 처리
 */
router.post('/chatbot/callback', async (req, res) => {
  try {
    const { userRequest, action } = req.body;
    
    // 사용자 ID 가져오기
    const userKey = userRequest?.user?.id || '';
    
    // 메시지 정보 가져오기
    const utterance = userRequest?.utterance || '';
    
    // 요청 타입 확인
    if (utterance.startsWith('/add')) {
      // 관심사 추가 요청
      return await handleAddKeyword(userKey, utterance, res);
    } else if (utterance.startsWith('/remove')) {
      // 관심사 제거 요청
      return await handleRemoveKeyword(userKey, utterance, res);
    } else if (utterance.startsWith('/my')) {
      // 내 관심사 조회
      return await handleListKeywords(userKey, res);
    } else if (utterance.startsWith('/set time')) {
      // 발송 시간 설정
      return await handleSetTime(userKey, utterance, res);
    } else {
      // 기본 응답
      return res.json({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: "안녕하세요! JikSend입니다. 다음 명령어를 사용할 수 있습니다:\n\n" +
                      "/add [키워드] - 관심사 추가하기\n" +
                      "/remove [키워드] - 관심사 제거하기\n" +
                      "/my - 내 관심사 조회하기\n" +
                      "/set time [HH:MM] - 발송 시간 설정하기"
              }
            }
          ]
        }
      });
    }
  } catch (error) {
    console.error('Kakao chatbot error:', error);
    return res.status(500).json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
            }
          }
        ]
      }
    });
  }
});

/**
 * 관심사 키워드 추가 처리
 */
async function handleAddKeyword(userKey: string, utterance: string, res: any) {
  try {
    // 키워드 추출 (/add tech -> tech)
    const keyword = utterance.replace('/add', '').trim().toLowerCase();
    
    if (!keyword) {
      return res.json({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: "추가할 키워드를 입력해주세요.\n예: /add tech"
              }
            }
          ]
        }
      });
    }
    
    // 사용자 확인 또는 생성
    let user = await prisma.user.findUnique({
      where: { kakaoId: userKey }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          kakaoId: userKey,
          provider: 'kakao'
        }
      });
    }
    
    // 이미 존재하는 키워드인지 확인
    const existingKeyword = await prisma.keyword.findFirst({
      where: {
        userId: user.id,
        keyword: keyword
      }
    });
    
    if (existingKeyword) {
      return res.json({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: `'${keyword}'는 이미 관심사로 등록되어 있습니다.`
              }
            }
          ]
        }
      });
    }
    
    // 키워드 추가
    await prisma.keyword.create({
      data: {
        userId: user.id,
        keyword: keyword,
        category: getCategoryForKeyword(keyword)
      }
    });
    
    return res.json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: `'${keyword}'를 관심사로 추가했습니다!`
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error adding keyword:', error);
    return res.status(500).json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: "키워드 추가 중 오류가 발생했습니다."
            }
          }
        ]
      }
    });
  }
}

/**
 * 관심사 키워드 제거 처리
 */
async function handleRemoveKeyword(userKey: string, utterance: string, res: any) {
  try {
    // 키워드 추출 (/remove tech -> tech)
    const keyword = utterance.replace('/remove', '').trim().toLowerCase();
    
    if (!keyword) {
      return res.json({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: "제거할 키워드를 입력해주세요.\n예: /remove tech"
              }
            }
          ]
        }
      });
    }
    
    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { kakaoId: userKey }
    });
    
    if (!user) {
      return res.json({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: "등록된 사용자가 아닙니다. 먼저 관심사를 추가해주세요."
              }
            }
          ]
        }
      });
    }
    
    // 키워드 제거
    const deleteResult = await prisma.keyword.deleteMany({
      where: {
        userId: user.id,
        keyword: keyword
      }
    });
    
    if (deleteResult.count === 0) {
      return res.json({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: `'${keyword}'는 관심사로 등록되어 있지 않습니다.`
              }
            }
          ]
        }
      });
    }
    
    return res.json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: `'${keyword}'를 관심사에서 제거했습니다!`
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error removing keyword:', error);
    return res.status(500).json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: "키워드 제거 중 오류가 발생했습니다."
            }
          }
        ]
      }
    });
  }
}

/**
 * 관심사 목록 조회 처리
 */
async function handleListKeywords(userKey: string, res: any) {
  try {
    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { kakaoId: userKey },
      include: {
        keywords: true
      }
    });
    
    if (!user) {
      return res.json({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: "등록된 사용자가 아닙니다. 먼저 관심사를 추가해주세요."
              }
            }
          ]
        }
      });
    }
    
    if (user.keywords.length === 0) {
      return res.json({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: "등록된 관심사가 없습니다.\n'/add [키워드]' 명령어로 관심사를 추가해보세요."
              }
            }
          ]
        }
      });
    }
    
    // 카테고리별로 그룹화
    const keywordsByCategory: Record<string, string[]> = {};
    user.keywords.forEach(k => {
      const category = k.category || '기타';
      if (!keywordsByCategory[category]) {
        keywordsByCategory[category] = [];
      }
      keywordsByCategory[category].push(k.keyword);
    });
    
    // 메시지 생성
    let message = "📋 내 관심사 목록\n\n";
    
    Object.entries(keywordsByCategory).forEach(([category, keywords]) => {
      message += `[${category}]\n`;
      keywords.forEach(k => {
        message += `- ${k}\n`;
      });
      message += '\n';
    });
    
    message += "발송 시간: " + (user.preferredTime || '08:00') + "\n\n";
    message += "관심사를 추가하려면: /add [키워드]\n";
    message += "관심사를 제거하려면: /remove [키워드]";
    
    return res.json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: message
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error listing keywords:', error);
    return res.status(500).json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: "관심사 목록 조회 중 오류가 발생했습니다."
            }
          }
        ]
      }
    });
  }
}

/**
 * 발송 시간 설정 처리
 */
async function handleSetTime(userKey: string, utterance: string, res: any) {
  try {
    // 시간 추출 (/set time 09:00 -> 09:00)
    const timeStr = utterance.replace('/set time', '').trim();
    
    // 시간 형식 검증 (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(timeStr)) {
      return res.json({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: "올바른 시간 형식을 입력해주세요.\n예: /set time 09:00"
              }
            }
          ]
        }
      });
    }
    
    // 사용자 확인 또는 생성
    let user = await prisma.user.findUnique({
      where: { kakaoId: userKey }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          kakaoId: userKey,
          provider: 'kakao',
          preferredTime: timeStr
        }
      });
    } else {
      // 발송 시간 업데이트
      user = await prisma.user.update({
        where: { id: user.id },
        data: { preferredTime: timeStr }
      });
    }
    
    return res.json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: `뉴스레터 발송 시간을 ${timeStr}로 설정했습니다!`
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error setting time:', error);
    return res.status(500).json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: "발송 시간 설정 중 오류가 발생했습니다."
            }
          }
        ]
      }
    });
  }
}

/**
 * 키워드에 해당하는 카테고리 반환
 */
function getCategoryForKeyword(keyword: string): string {
  const categoryMap: Record<string, string[]> = {
    '기술': ['tech', '기술', '테크', 'it', '컴퓨터', '프로그래밍', '코딩', 'ai', '인공지능', '머신러닝'],
    '경제': ['business', 'biz', '경제', '비즈니스', '주식', '투자', '창업', '스타트업', '금융'],
    '정치': ['politics', '정치', '정부', '국회', '대통령', '선거', '법안'],
    '문화': ['culture', '문화', '영화', '음악', '공연', '예술', '엔터테인먼트', '연예', '드라마'],
    '스포츠': ['sports', '스포츠', '축구', '야구', '농구', '올림픽', '월드컵'],
    '글로벌': ['global', '국제', '세계', '해외', '외신', '국제뉴스'],
    '과학': ['science', '과학', '우주', '물리', '화학', '생물', '의학', '연구'],
    '건강': ['health', '건강', '의료', '피트니스', '다이어트', '웰빙', '질병'],
  };
  
  // 키워드가 어느 카테고리에 속하는지 확인
  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => keyword.includes(k))) {
      return category;
    }
  }
  
  return '기타'; // 해당하는 카테고리가 없을 경우
}

export default router; 