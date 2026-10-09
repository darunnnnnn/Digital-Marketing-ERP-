-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "videoPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scriptPrice" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "videoPrice" INTEGER,
ADD COLUMN     "scriptPrice" INTEGER;
