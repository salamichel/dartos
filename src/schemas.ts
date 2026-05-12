import { z } from "zod";

// A participant must declare their final rank. Only the last (highest-ranked
// numerically = losing) player carries a score_left. We let the route handler
// enforce the cross-field invariants once it knows N (the participant count).
export const participantSchema = z.object({
  playerId: z.number().int().positive(),
  rank: z.number().int().positive(),
  scoreLeft: z.number().int().min(0).max(301).optional(),
});

export const recordMatchSchema = z
  .object({
    seasonId: z.number().int().positive(),
    playedAt: z.coerce.date().optional(),
    participants: z.array(participantSchema).min(2),
  })
  .superRefine((data, ctx) => {
    const n = data.participants.length;
    const ranks = data.participants.map((p) => p.rank).sort((a, b) => a - b);

    // Ranks must form 1..N with no duplicates.
    for (let i = 0; i < n; i++) {
      if (ranks[i] !== i + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Ranks must be a permutation of 1..${n}`,
          path: ["participants"],
        });
        return;
      }
    }

    // Unique players.
    const playerIds = new Set(data.participants.map((p) => p.playerId));
    if (playerIds.size !== n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A player cannot appear twice in the same match",
        path: ["participants"],
      });
    }

    // score_left rules: only the last player (rank === N) carries it, and it
    // must be strictly > 0 (otherwise they would have won).
    for (const p of data.participants) {
      const isLast = p.rank === n;
      if (isLast) {
        if (p.scoreLeft === undefined || p.scoreLeft <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "The last-ranked player must report a positive score_left",
            path: ["participants"],
          });
        }
      } else if (p.scoreLeft !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Only the last-ranked player may report a score_left",
          path: ["participants"],
        });
      }
    }
  });

export type RecordMatchInput = z.infer<typeof recordMatchSchema>;

export const createPlayerSchema = z.object({
  name: z.string().trim().min(1).max(64),
});

export const createSeasonSchema = z.object({
  name: z.string().trim().min(1).max(64),
});
