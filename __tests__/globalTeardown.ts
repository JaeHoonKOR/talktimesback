/**
 * 전역 테스트 정리 - 모든 테스트 실행 후에 한 번만 실행됩니다.
 */
export default async function globalTeardown() {
  console.log('\n🧹 Jest 전역 정리 시작...');
  
  try {
    // 테스트 중 생성된 임시 파일 정리
    // (필요시 추가 구현)
    
    // 데이터베이스 연결 정리
    // (실제 DB 연결이 있는 경우 정리)
    
    // 외부 서비스 모킹 정리
    // (필요시 추가 구현)
    
    console.log('✅ 전역 테스트 정리 완료');
    console.log('🎉 모든 테스트가 완료되었습니다!');
    
  } catch (error) {
    console.error('❌ 테스트 정리 중 오류 발생:', error);
    // 오류가 발생해도 테스트 프로세스는 계속 진행
  }
} 