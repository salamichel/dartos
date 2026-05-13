# dartos — Darts League (301) API

Backend for managing a multi-week darts league: players, seasons, matches with
2..N participants, and an automatic leaderboard.

## Stack

- Node.js 20 + TypeScript + Express
- PostgreSQL 16 + Prisma ORM
- Zod for input validation
- Docker Compose

## Run

```bash
cp .env.example .env
docker compose up --build
```

API on http://localhost:3000. Web UI on the same URL (`/`).

## Data model

```
Player (id, name, created_at)
Season (id, name, started_at, ended_at?)
Match  (id, season_id -> Season, played_at)
MatchParticipant (match_id, player_id, rank, score_left?, xp_earned, finish_type?) -- M:N + result
  PK (match_id, player_id)
  UNIQUE (match_id, rank)        -- no rank ties
```

`score_left` is set for **all** losing players. `finish_type` (SIMPLE, DOUBLE, TRIPLE) is set for the winner.

## Endpoints

### `POST /players`
```json
{ "name": "Alice" }
```

### `POST /seasons`
```json
{ "name": "Spring 2026" }
```

### `POST /matches` — record a finished match (Sudden Death)
```json
{
  "seasonId": 1,
  "winner": {
    "playerId": 1,
    "finishType": "DOUBLE"
  },
  "losers": [
    { "playerId": 2, "scoreLeft": 42 },
    { "playerId": 3, "scoreLeft": 120 }
  ]
}
```
Validation enforced server-side:
- ≥ 2 participants, unique players.
- Winner rank is 1. Losers are ranked automatically by `scoreLeft` ascending.

### `GET /leaderboard`
Returns the global leaderboard with RPG-style progression.

**XP Rules (Default):**
1. **Winner**:
   - +50 XP per defeated opponent.
   - Bonus Finition: Simple (+0), Double (+50), Triple/Bulle (+100).
   - Zone Vampire: +1 XP per remaining point on the board (sum of losers' `scoreLeft`).
2. **Survivors** (all losers): +20 XP.

*Note: The "Cul Rouge" tax has been removed. Rules are now configurable per season.*

**Levels:**
- Lvl 1: Pousse-Caillou (0 - 499 XP)
- Lvl 2: Lanceur du Dimanche (500 - 1999 XP)
- Lvl 3: Sniper de Comptoir (2000 - 4999 XP)
- Lvl 4: Maître du 301 (5000 - 9999 XP)
- Lvl 5: Phil Taylor (10000+ XP)

```json
[
  {
    "id": 1,
    "name": "Alice",
    "totalXP": 1250,
    "matchCount": 8,
    "xpPerMatch": 156.25,
    "level": "Lanceur du Dimanche"
  }
]
```
