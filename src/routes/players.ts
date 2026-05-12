import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { createPlayerSchema } from "../schemas";

export const playersRouter = Router();

playersRouter.post("/", async (req, res) => {
  const parsed = createPlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const player = await prisma.player.create({ data: parsed.data });
    return res.status(201).json(player);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "A player with this name already exists" });
    }
    throw e;
  }
});

playersRouter.get("/", async (_req, res) => {
  const players = await prisma.player.findMany({ orderBy: { createdAt: "asc" } });
  res.json(players);
});
