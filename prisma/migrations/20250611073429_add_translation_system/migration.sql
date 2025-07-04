-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "targetLang" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Translation_sourceText_targetLang_idx" ON "Translation"("sourceText", "targetLang");

-- CreateIndex
CREATE INDEX "Translation_lastUsedAt_idx" ON "Translation"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_sourceText_targetLang_key" ON "Translation"("sourceText", "targetLang");
