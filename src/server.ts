import path from "path";
import express, { NextFunction, Request, Response } from "express";
import { playersRouter } from "./routes/players";
import { seasonsRouter } from "./routes/seasons";
import { matchesRouter } from "./routes/matches";
import { leaderboardRouter } from "./routes/leaderboard";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/players", playersRouter);
app.use("/seasons", seasonsRouter);
app.use("/matches", matchesRouter);
app.use("/leaderboard", leaderboardRouter);

// Static web UI. `public/` sits at the project root, alongside `dist/`.
app.use(express.static(path.join(__dirname, "..", "public")));

// Catch-all error handler so async throws return JSON, not HTML stack traces.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`dartos API listening on :${port}`);
});
