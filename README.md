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
MatchParticipant (match_id, player_id, rank, score_left?)   -- M:N + result
  PK (match_id, player_id)
  UNIQUE (match_id, rank)        -- no rank ties
```

`score_left` is set **only** for the last-ranked (losing) player; everyone
else closed out at 0.

## Endpoints

### `POST /players`
```json
{ "name": "Alice" }
```

### `POST /seasons`
```json
{ "name": "Spring 2026" }
```

### `POST /matches` — record a finished match
```json
{
  "seasonId": 1,
  "participants": [
    { "playerId": 1, "rank": 1 },
    { "playerId": 2, "rank": 2 },
    { "playerId": 3, "rank": 3, "scoreLeft": 84 }
  ]
}
```
Validation enforced server-side:
- ≥ 2 participants, unique players
- ranks form a permutation of `1..N`
- only the rank-N participant carries `scoreLeft`, and it must be `> 0`

### `GET /seasons/:id/leaderboard`
Computes points per match (1st=10, 2nd=6, 3rd=4, 4th=2, others=1) and ranks
players by **average points per match** (tiebreakers: total points, wins).
Using the average avoids penalizing newcomers who joined the league late.

```json
{
  "seasonId": 1,
  "seasonName": "Spring 2026",
  "leaderboard": [
    { "position": 1, "playerId": 1, "playerName": "Alice",
      "matchesPlayed": 8, "totalPoints": 72, "wins": 5, "averagePoints": 9.0 }
  ]
}
```
