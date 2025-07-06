-- News 테이블에 인덱스 추가
CREATE INDEX IF NOT EXISTS "News_category_idx" ON "News" ("category");
CREATE INDEX IF NOT EXISTS "News_source_idx" ON "News" ("source");
CREATE INDEX IF NOT EXISTS "News_publishedAt_idx" ON "News" ("publishedAt");
CREATE INDEX IF NOT EXISTS "News_isProcessed_idx" ON "News" ("isProcessed");
CREATE INDEX IF NOT EXISTS "News_createdAt_idx" ON "News" ("createdAt");

-- NewsSummary 테이블에 인덱스 추가
CREATE INDEX IF NOT EXISTS "NewsSummary_category_idx" ON "NewsSummary" ("category");
CREATE INDEX IF NOT EXISTS "NewsSummary_createdAt_idx" ON "NewsSummary" ("createdAt");
CREATE INDEX IF NOT EXISTS "NewsSummary_keywords_idx" ON "NewsSummary" USING GIN ("keywords");

-- 인덱스 생성 확인 메시지
SELECT 'News 및 NewsSummary 테이블 인덱스 생성 완료' AS message; 