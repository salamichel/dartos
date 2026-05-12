-- Initial schema for the dartos darts league API.

CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "players_name_key" ON "players"("name");

CREATE TABLE "seasons" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seasons_name_key" ON "seasons"("name");

CREATE TABLE "matches" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "matches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "matches_season_id_fkey" FOREIGN KEY ("season_id")
        REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "matches_season_id_idx" ON "matches"("season_id");
CREATE INDEX "matches_played_at_idx" ON "matches"("played_at");

CREATE TABLE "match_participants" (
    "match_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "score_left" INTEGER,
    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("match_id","player_id"),
    CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id")
        REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_participants_player_id_fkey" FOREIGN KEY ("player_id")
        REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "match_participants_match_id_rank_key"
    ON "match_participants"("match_id","rank");
CREATE INDEX "match_participants_player_id_idx" ON "match_participants"("player_id");
