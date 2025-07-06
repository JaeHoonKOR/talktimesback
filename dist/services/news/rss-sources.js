"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RSS_SOURCES = exports.LANGUAGES = exports.CATEGORIES = void 0;
exports.getRssSourcesByCategory = getRssSourcesByCategory;
exports.getActiveRssSources = getActiveRssSources;
exports.getRssSourceById = getRssSourceById;
/**
 * 카테고리 상수
 */
exports.CATEGORIES = {
    TECH: '기술',
    BUSINESS: '경제',
    POLITICS: '정치',
    CULTURE: '문화',
    SPORTS: '스포츠',
    SCIENCE: '과학',
    HEALTH: '건강',
};
/**
 * 언어 상수
 */
exports.LANGUAGES = {
    EN: 'en',
    KO: 'ko',
};
/**
 * RSS 피드 소스 목록
 */
exports.RSS_SOURCES = [
    // 기술 (Technology)
    {
        id: 'techcrunch',
        name: 'TechCrunch',
        url: 'https://techcrunch.com/feed/',
        category: exports.CATEGORIES.TECH,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'theverge',
        name: 'The Verge',
        url: 'https://www.theverge.com/rss/index.xml',
        category: exports.CATEGORIES.TECH,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'wired',
        name: 'Wired',
        url: 'https://www.wired.com/feed/rss',
        category: exports.CATEGORIES.TECH,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-technology',
        name: 'Reddit - Technology',
        url: 'https://www.reddit.com/r/technology/.rss',
        category: exports.CATEGORIES.TECH,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-gadgets',
        name: 'Reddit - Gadgets',
        url: 'https://www.reddit.com/r/gadgets/.rss',
        category: exports.CATEGORIES.TECH,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    // 경제 (Business/Economy)
    {
        id: 'bloomberg',
        name: 'Bloomberg',
        url: 'https://feeds.bloomberg.com/markets/news.rss',
        category: exports.CATEGORIES.BUSINESS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'cnbc',
        name: 'CNBC',
        url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
        category: exports.CATEGORIES.BUSINESS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-business',
        name: 'Reddit - Business',
        url: 'https://www.reddit.com/r/business/.rss',
        category: exports.CATEGORIES.BUSINESS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-economics',
        name: 'Reddit - Economics',
        url: 'https://www.reddit.com/r/economics/.rss',
        category: exports.CATEGORIES.BUSINESS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    // 정치 (Politics)
    {
        id: 'politico',
        name: 'Politico',
        url: 'https://www.politico.com/rss/politics08.xml',
        category: exports.CATEGORIES.POLITICS,
        language: exports.LANGUAGES.EN,
        isActive: false,
    },
    {
        id: 'bbc-politics',
        name: 'BBC Politics',
        url: 'http://feeds.bbci.co.uk/news/politics/rss.xml',
        category: exports.CATEGORIES.POLITICS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'thehill',
        name: 'The Hill',
        url: 'https://thehill.com/feed/',
        category: exports.CATEGORIES.POLITICS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-politics',
        name: 'Reddit - Politics',
        url: 'https://www.reddit.com/r/politics/.rss',
        category: exports.CATEGORIES.POLITICS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-worldnews',
        name: 'Reddit - World News',
        url: 'https://www.reddit.com/r/worldnews/.rss',
        category: exports.CATEGORIES.POLITICS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    // 문화 (Culture)
    {
        id: 'guardian-culture',
        name: 'The Guardian - Culture',
        url: 'https://www.theguardian.com/culture/rss',
        category: exports.CATEGORIES.CULTURE,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'rollingstone',
        name: 'Rolling Stone',
        url: 'https://www.rollingstone.com/music/music-news/feed/',
        category: exports.CATEGORIES.CULTURE,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'newyorker',
        name: 'The New Yorker',
        url: 'https://www.newyorker.com/feed/everything',
        category: exports.CATEGORIES.CULTURE,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-books',
        name: 'Reddit - Books',
        url: 'https://www.reddit.com/r/books/.rss',
        category: exports.CATEGORIES.CULTURE,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-movies',
        name: 'Reddit - Movies',
        url: 'https://www.reddit.com/r/movies/.rss',
        category: exports.CATEGORIES.CULTURE,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-art',
        name: 'Reddit - Art',
        url: 'https://www.reddit.com/r/Art/.rss',
        category: exports.CATEGORIES.CULTURE,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    // 스포츠 (Sports)
    {
        id: 'espn',
        name: 'ESPN',
        url: 'https://www.espn.com/espn/rss/news',
        category: exports.CATEGORIES.SPORTS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'skysports',
        name: 'Sky Sports',
        url: 'https://www.skysports.com/rss/12040',
        category: exports.CATEGORIES.SPORTS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-sports',
        name: 'Reddit - Sports',
        url: 'https://www.reddit.com/r/sports/.rss',
        category: exports.CATEGORIES.SPORTS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-soccer',
        name: 'Reddit - Soccer',
        url: 'https://www.reddit.com/r/soccer/.rss',
        category: exports.CATEGORIES.SPORTS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-nba',
        name: 'Reddit - NBA',
        url: 'https://www.reddit.com/r/nba/.rss',
        category: exports.CATEGORIES.SPORTS,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    // 과학 (Science)
    {
        id: 'scientific-american',
        name: 'Scientific American',
        url: 'https://www.scientificamerican.com/feed/rss/',
        category: exports.CATEGORIES.SCIENCE,
        language: exports.LANGUAGES.EN,
        isActive: false,
    },
    {
        id: 'nature',
        name: 'Nature',
        url: 'https://www.nature.com/nature/articles?type=news&format=rss',
        category: exports.CATEGORIES.SCIENCE,
        language: exports.LANGUAGES.EN,
        isActive: false,
    },
    {
        id: 'reddit-science',
        name: 'Reddit - Science',
        url: 'https://www.reddit.com/r/science/.rss',
        category: exports.CATEGORIES.SCIENCE,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-space',
        name: 'Reddit - Space',
        url: 'https://www.reddit.com/r/space/.rss',
        category: exports.CATEGORIES.SCIENCE,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    // 건강 (Health)
    {
        id: 'medical-news-today',
        name: 'Medical News Today',
        url: 'https://www.medicalnewstoday.com/rss',
        category: exports.CATEGORIES.HEALTH,
        language: exports.LANGUAGES.EN,
        isActive: false,
    },
    {
        id: 'webmd',
        name: 'WebMD',
        url: 'https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC',
        category: exports.CATEGORIES.HEALTH,
        language: exports.LANGUAGES.EN,
        isActive: false,
    },
    {
        id: 'reddit-health',
        name: 'Reddit - Health',
        url: 'https://www.reddit.com/r/Health/.rss',
        category: exports.CATEGORIES.HEALTH,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-nutrition',
        name: 'Reddit - Nutrition',
        url: 'https://www.reddit.com/r/nutrition/.rss',
        category: exports.CATEGORIES.HEALTH,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
    {
        id: 'reddit-fitness',
        name: 'Reddit - Fitness',
        url: 'https://www.reddit.com/r/fitness/.rss',
        category: exports.CATEGORIES.HEALTH,
        language: exports.LANGUAGES.EN,
        isActive: true,
    },
];
/**
 * 카테고리별 RSS 소스 목록을 가져오는 함수
 */
function getRssSourcesByCategory(category) {
    return exports.RSS_SOURCES.filter((source) => source.category === category && source.isActive);
}
/**
 * 활성화된 모든 RSS 소스 목록을 가져오는 함수
 */
function getActiveRssSources() {
    return exports.RSS_SOURCES.filter((source) => source.isActive);
}
/**
 * 특정 ID의 RSS 소스를 가져오는 함수
 */
function getRssSourceById(id) {
    return exports.RSS_SOURCES.find((source) => source.id === id);
}
