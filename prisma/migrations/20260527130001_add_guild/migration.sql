-- AlterTable
ALTER TABLE "seasons" DROP COLUMN "bonus_vainqueur_par_rang",
DROP COLUMN "xp_bonus_benjamin",
DROP COLUMN "xp_bonus_phenix",
DROP COLUMN "xp_bonus_serial_winner";

-- CreateTable
CREATE TABLE "guilds" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "badge_icon" TEXT NOT NULL,
    "badge_color" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_guilds" (
    "player_id" INTEGER NOT NULL,
    "guild_id" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_guilds_pkey" PRIMARY KEY ("player_id","guild_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guilds_name_key" ON "guilds"("name");

-- CreateIndex
CREATE INDEX "player_guilds_player_id_idx" ON "player_guilds"("player_id");

-- CreateIndex
CREATE INDEX "player_guilds_guild_id_idx" ON "player_guilds"("guild_id");

-- AddForeignKey
ALTER TABLE "player_guilds" ADD CONSTRAINT "player_guilds_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_guilds" ADD CONSTRAINT "player_guilds_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
