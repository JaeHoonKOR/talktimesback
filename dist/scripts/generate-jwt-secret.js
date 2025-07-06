#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jwt_secret_generator_1 = require("../utils/jwt-secret-generator");
/**
 * JWT Secret 생성 CLI 도구
 */
class JWTSecretGenerator {
    static showHelp() {
        console.log(`
🔐 JWT Secret Generator

사용법:
  npm run generate-jwt-secret [옵션]

옵션:
  --length <숫자>    생성할 시크릿 키 길이 (기본값: 64)
  --generate-only    시크릿만 생성하고 .env 파일에 저장하지 않음
  --auto-setup       모든 보안 키를 자동으로 설정
  --help             이 도움말 표시

예시:
  npm run generate-jwt-secret                    # 기본 64자 시크릿 생성 및 .env 저장
  npm run generate-jwt-secret --length 128       # 128자 시크릿 생성
  npm run generate-jwt-secret --generate-only    # 시크릿만 생성 (저장하지 않음)
  npm run generate-jwt-secret --auto-setup       # 모든 보안 키 자동 설정
`);
    }
    static generateOnly(length) {
        const secret = (0, jwt_secret_generator_1.generateJWTSecret)(length);
        console.log(`\n🔑 생성된 JWT Secret:`);
        console.log(`"${secret}"`);
        console.log(`\n📝 .env 파일에 다음과 같이 추가하세요:`);
        console.log(`JWT_SECRET="${secret}"`);
        console.log(`\n⚠️  이 키를 안전하게 보관하세요!`);
    }
    static autoSetup() {
        try {
            console.log('\n🔧 자동 보안 키 설정 시작...');
            const secrets = (0, jwt_secret_generator_1.ensureAllSecrets)();
            console.log('\n✅ 자동 보안 키 설정 완료!');
            console.log(`📊 JWT_SECRET 길이: ${secrets.jwtSecret.length}자`);
            console.log(`📊 NEXTAUTH_SECRET 길이: ${secrets.nextAuthSecret.length}자`);
            console.log('\n🚀 서버를 재시작하면 새로운 키가 적용됩니다.');
        }
        catch (error) {
            console.error('❌ 자동 설정 실패:', error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    }
    static generateAndSave(length) {
        try {
            console.log(`\n🔧 ${length}자 JWT Secret 생성 중...`);
            const secret = (0, jwt_secret_generator_1.generateJWTSecret)(length);
            // .env 파일에 저장하는 로직은 ensureJWTSecret에서 처리
            process.env.JWT_SECRET = secret;
            console.log('\n✅ JWT Secret 생성 완료!');
            console.log(`📊 생성된 키 길이: ${secret.length}자`);
            console.log(`🔑 생성된 키: ${secret.substring(0, 8)}...${secret.substring(secret.length - 8)}`);
            console.log('\n📝 .env 파일에 다음과 같이 추가하세요:');
            console.log(`JWT_SECRET="${secret}"`);
            console.log('\n⚠️  이 키를 안전하게 보관하세요!');
        }
        catch (error) {
            console.error('❌ JWT Secret 생성 실패:', error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    }
    static run() {
        const args = process.argv.slice(2);
        // 도움말 표시
        if (args.includes('--help') || args.includes('-h')) {
            this.showHelp();
            return;
        }
        // 길이 옵션 파싱
        const lengthIndex = args.indexOf('--length');
        let length = 64;
        if (lengthIndex !== -1 && args[lengthIndex + 1]) {
            const parsedLength = parseInt(args[lengthIndex + 1], 10);
            if (isNaN(parsedLength) || parsedLength < 16) {
                console.error('❌ 길이는 16 이상의 숫자여야 합니다.');
                process.exit(1);
            }
            length = parsedLength;
        }
        // 옵션별 실행
        if (args.includes('--auto-setup')) {
            this.autoSetup();
        }
        else if (args.includes('--generate-only')) {
            this.generateOnly(length);
        }
        else {
            this.generateAndSave(length);
        }
    }
}
// 스크립트 실행
if (require.main === module) {
    console.log('🔐 JWT Secret Generator v1.0.0');
    JWTSecretGenerator.run();
}
