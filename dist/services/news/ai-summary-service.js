"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSummary = void 0;
exports.summarizeNewsItem = summarizeNewsItem;
exports.createSummaryFromNews = createSummaryFromNews;
exports.batchProcessUnprocessedNews = batchProcessUnprocessedNews;
const openai_1 = __importDefault(require("openai"));
const uuid_1 = require("uuid");
const newsRepo = __importStar(require("./news-repository"));
// OpenAI API 설정
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
/**
 * 단일 뉴스를 요약하는 함수
 */
function summarizeNewsItem(newsItem) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        if (!newsItem.content) {
            return newsItem.excerpt;
        }
        try {
            const contentToSummarize = newsItem.content.length > 8000
                ? newsItem.content.slice(0, 8000)
                : newsItem.content;
            const response = yield openai.chat.completions.create({
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
            const summary = ((_c = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim()) || newsItem.excerpt;
            // 뉴스 처리 상태 업데이트
            yield newsRepo.updateNewsProcessingStatus(newsItem.id, true);
            return summary;
        }
        catch (error) {
            console.error('뉴스 요약 중 오류 발생:', error);
            return newsItem.excerpt;
        }
    });
}
/**
 * 여러 뉴스 항목을 요약하고 하나의 통합 요약 생성
 */
function createSummaryFromNews(newsItems, category) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        if (newsItems.length === 0) {
            throw new Error('요약할 뉴스가 없습니다.');
        }
        const newsContents = newsItems.map((item) => `제목: ${item.title}\n내용: ${item.excerpt}\n출처: ${item.source}\n`).join('\n');
        try {
            const response = yield openai.chat.completions.create({
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
            const result = ((_c = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim()) || '';
            // 요약과 키워드 분리 (형식: "요약: ... \n\n키워드: 키워드1, 키워드2, ...")
            let summary = result;
            let keywords = [];
            const keywordMatch = result.match(/키워드(?:\s*|:\s*)([^]*)/i);
            if (keywordMatch) {
                // 키워드 부분 추출
                const keywordText = keywordMatch[1].trim();
                keywords = keywordText.split(/,|、|，|\n/).map(k => k.trim()).filter(Boolean);
                // 요약 부분만 추출 (키워드 부분 제외)
                summary = result.substring(0, result.indexOf(keywordMatch[0])).trim();
            }
            // 뉴스 처리 상태 업데이트
            yield Promise.all(newsItems.map((item) => item.id ? newsRepo.updateNewsProcessingStatus(item.id, true) : Promise.resolve()));
            // 제목 생성
            const titleResponse = yield openai.chat.completions.create({
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
            const title = ((_f = (_e = (_d = titleResponse.choices[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content) === null || _f === void 0 ? void 0 : _f.trim()) ||
                `${category} 뉴스 요약`;
            return {
                id: (0, uuid_1.v4)(),
                originalNewsIds: newsItems.filter(item => item.id).map(item => item.id) || [],
                category,
                title,
                summary,
                keywords: keywords.length > 0 ? keywords : ['뉴스', category],
                createdAt: new Date(),
            };
        }
        catch (error) {
            console.error('통합 뉴스 요약 생성 중 오류 발생:', error);
            // 오류 발생 시 기본 요약 반환
            return {
                id: (0, uuid_1.v4)(),
                originalNewsIds: newsItems.filter(item => item.id).map(item => item.id) || [],
                category,
                title: `${category} 주요 뉴스`,
                summary: newsItems.map(item => item.title).join('\n'),
                keywords: [category],
                createdAt: new Date(),
            };
        }
    });
}
/**
 * 처리되지 않은 뉴스 항목들을 일괄 요약
 */
function batchProcessUnprocessedNews() {
    return __awaiter(this, arguments, void 0, function* (limit = 20) {
        const unprocessedNews = yield newsRepo.getUnprocessedNewsItems(limit);
        if (unprocessedNews.length === 0) {
            return 0;
        }
        // 카테고리별로 뉴스 그룹화
        const newsByCategory = {};
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
                    yield createSummaryFromNews(items, category);
                    processedCount += items.length;
                }
                catch (error) {
                    console.error(`${category} 뉴스 일괄 처리 중 오류 발생:`, error);
                }
            }
        }
        return processedCount;
    });
}
/**
 * 뉴스 요약 생성 (별칭)
 */
exports.generateSummary = summarizeNewsItem;
