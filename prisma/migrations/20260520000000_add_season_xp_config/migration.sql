-- AlterTable
ALTER TABLE "seasons" ADD COLUMN "xp_per_defeated_opponent" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "seasons" ADD COLUMN "xp_bonus_simple" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "seasons" ADD COLUMN "xp_bonus_double" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "seasons" ADD COLUMN "xp_bonus_triple" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "seasons" ADD COLUMN "xp_vampire_multiplier" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "seasons" ADD COLUMN "xp_survivor_base" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "seasons" ADD COLUMN "xp_bonus_poulidor" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "seasons" ADD COLUMN "xp_bonus_jackpot" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "seasons" ADD COLUMN "xp_bonus_egalite" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "seasons" ADD COLUMN "xp_bonus_tueur_de_geants" INTEGER NOT NULL DEFAULT 50;
