ALTER TABLE "seasons" ADD COLUMN     "bonus_vainqueur_par_rang" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "xp_bonus_benjamin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp_bonus_phenix" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp_bonus_serial_winner" INTEGER NOT NULL DEFAULT 0;
