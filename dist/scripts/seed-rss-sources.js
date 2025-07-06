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
const client_1 = require("@prisma/client");
const rss_sources_1 = require("../services/news/rss-sources");
const prisma = new client_1.PrismaClient();
/**
 * RSS 소스 정보를 데이터베이스에 저장하는 함수
 */
function seedRssSources() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('RSS 소스 정보를 데이터베이스에 저장합니다...');
            // 기존 소스 정보 초기화 (선택적)
            // await prisma.newsSource.deleteMany({});
            // 각 RSS 소스를 순회하며 데이터베이스에 저장
            for (const source of rss_sources_1.RSS_SOURCES) {
                // 이미 존재하는지 확인
                const existingSource = yield prisma.newsSource.findFirst({
                    where: {
                        name: source.name,
                        url: source.url,
                    },
                });
                if (existingSource) {
                    // 이미 존재하는 경우 업데이트
                    yield prisma.newsSource.update({
                        where: { id: existingSource.id },
                        data: {
                            url: source.url,
                            category: source.category,
                            type: 'rss',
                            active: source.isActive,
                        },
                    });
                    console.log(`${source.name} 소스 정보를 업데이트했습니다.`);
                }
                else {
                    // 존재하지 않는 경우 새로 생성
                    yield prisma.newsSource.create({
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
        }
        catch (error) {
            console.error('RSS 소스 정보 저장 중 오류 발생:', error);
        }
        finally {
            yield prisma.$disconnect();
        }
    });
}
// 스크립트 실행
seedRssSources();
