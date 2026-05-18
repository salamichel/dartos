import { z } from "zod";

// A participant must declare their final rank. Only the last (highest-ranked
// numerically = losing) player carries a score_left. We let the route handler
// enforce the cross-field invariants once it knows N (the participant count).
export const recordMatchSchema = z.object({
  seasonId: z.number().int().positive(),
  playedAt: z.coerce.date().optional(),
  winner: z.object({
    playerId: z.number().int().positive(),
    finishType: z.enum(["SIMPLE", "DOUBLE", "TRIPLE"]),
  }),
  losers: z.array(
    z.object({
      playerId: z.number().int().positive(),
      scoreLeft: z.number().int().positive().max(301),
    })
  ).min(1),
}).superRefine((data, ctx) => {
  const playerIds = new Set();
  playerIds.add(data.winner.playerId);
  
  for (let i = 0; i < data.losers.length; i++) {
    const lp = data.losers[i];
    if (playerIds.has(lp.playerId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Player ID ${lp.playerId} appears more than once`,
        path: ["losers", i, "playerId"],
      });
    }
    playerIds.add(lp.playerId);
  }
});

export type RecordMatchInput = z.infer<typeof recordMatchSchema>;

export const createPlayerSchema = z.object({
  name: z.string().trim().min(1).max(64),
});

const seasonRulesSchema = z.object({
  xpPerDefeatedOpponent: z.number().int().min(0).optional(),
  xpBonusSimple: z.number().int().min(0).optional(),
  xpBonusDouble: z.number().int().min(0).optional(),
  xpBonusTriple: z.number().int().min(0).optional(),
  xpVampireMultiplier: z.number().int().min(0).optional(),
  xpSurvivorBase: z.number().int().min(0).optional(),
  xpBonusPoulidor: z.number().int().min(0).optional(),
  xpBonusJackpot: z.number().int().min(0).optional(),
  xpBonusEgalite: z.number().int().min(0).optional(),
  xpBonusTueurDeGeants: z.number().int().min(0).optional(),
  xpBonusPhenix: z.number().int().min(0).optional(),
  xpBonusSerialWinner: z.number().int().min(0).optional(),
  xpBonusBenjamin: z.number().int().min(0).optional(),
  bonusVainqueurParRang: z.boolean().optional(),
});

export const createSeasonSchema = seasonRulesSchema.extend({
  name: z.string().trim().min(1).max(64),
});

export const updateSeasonSchema = seasonRulesSchema.extend({
  name: z.string().trim().min(1).max(64).optional(),
});
