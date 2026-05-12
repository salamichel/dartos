-- AlterTable
ALTER TABLE "match_participants" ADD COLUMN "xp_earned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "finish_type" TEXT;
