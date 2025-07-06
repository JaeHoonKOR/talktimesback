"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const news_scheduler_1 = require("../services/news/news-scheduler");
/**
 * RSS 뉴스를 가져오고 저장하는 메인 함수
 */
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('RSS 뉴스 가져오기 및 저장 프로세스 시작...');
            // 오래된 뉴스 정리
            yield (0, news_scheduler_1.cleanupOldNews)();
            // 모든 카테고리의 뉴스 가져오기
            const results = yield (0, news_scheduler_1.fetchAndStoreAllCategories)();
            console.log('RSS 뉴스 가져오기 및 저장 프로세스 완료!');
            console.log('결과 요약:');
            console.table(results);
        }
        catch (error) {
            console.error('뉴스 가져오기 및 저장 프로세스 중 오류 발생:', error);
            process.exit(1);
        }
    });
}
// 스크립트 실행
main();
