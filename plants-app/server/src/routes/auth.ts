import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword, signToken, verifyPassword } from "../auth.ts";
import { nowIso, uid } from "../util.ts";
import type { Deps } from "./ctx.ts";

const body = z.object({ email: z.string().email().max(200).transform((s) => s.toLowerCase().trim()), password: z.string().min(8).max(200) });

export function authRoutes(app: FastifyInstance, { cfg, db }: Deps) {
  const rl = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };
  app.post("/api/auth/register", rl, async (req, reply) => {
    const b = body.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: { code: "bad_request", message_he: "אימייל או סיסמה לא תקינים (סיסמה: לפחות 8 תווים)." } });
    if (cfg.signupCode && (req.body as any)?.code !== cfg.signupCode)
      return reply.code(403).send({ error: { code: "bad_code", message_he: "קוד ההרשמה שגוי." } });
    if (await db.get("select 1 as x from users where email = ?", [b.data.email]))
      return reply.code(409).send({ error: { code: "exists", message_he: "האימייל כבר רשום." } });
    const id = uid();
    await db.run("insert into users(id, email, pass_hash, created_at) values(?,?,?,?)", [id, b.data.email, await hashPassword(b.data.password), nowIso()]);
    return { token: signToken(id, cfg.jwtSecret) };
  });
  app.post("/api/auth/login", rl, async (req, reply) => {
    const b = body.safeParse(req.body);
    const u = b.success ? await db.get<any>("select * from users where email = ?", [b.data.email]) : undefined;
    if (!b.success || !u || !(await verifyPassword(b.data.password, u.pass_hash)))
      return reply.code(401).send({ error: { code: "bad_credentials", message_he: "אימייל או סיסמה שגויים." } });
    return { token: signToken(u.id, cfg.jwtSecret) };
  });
}
