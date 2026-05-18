import { Request, Response, NextFunction } from "express";

export function requireAdminPassword(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return next();
  if (req.headers["x-admin-password"] !== expected) {
    return res.status(401).json({ error: "Mot de passe incorrect" });
  }
  next();
}
