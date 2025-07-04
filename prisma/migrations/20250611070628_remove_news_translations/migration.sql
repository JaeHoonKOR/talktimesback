/*
  Warnings:

  - You are about to drop the `NewsTranslation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "NewsTranslation" DROP CONSTRAINT "NewsTranslation_newsId_fkey";

-- DropTable
DROP TABLE "NewsTranslation";
