import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { he } from "../../shared/he.ts";
import { createModel, type PlantModel } from "./ai/model.ts";
import { requireAuth } from "./auth.ts";
import type { Config } from "./config.ts";
import type { Db } from "./db/index.ts";
import { aiRoutes } from "./routes/ai.ts";
import { authRoutes } from "./routes/auth.ts";
import { miscRoutes } from "./routes/misc.ts";
import { plantRoutes } from "./routes/plants.ts";
import { HttpError } from "./util.ts";

export async function buildApp(cfg: Config, db: Db, model: PlantModel = createModel(cfg)) {
  const app = Fastify({ logger: false, bodyLimit: 12 * 1024 * 1024, trustProxy: cfg.isProd });
  await app.register(cors, { origin: cfg.corsOrigin });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute", errorResponseBuilder: () => ({ statusCode: 429, error: { code: "rate_limited", message_he: he.rateLimited } }) });

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: { code: err.code, message_he: err.messageHe } });
    if (err.statusCode === 413) return reply.code(413).send({ error: { code: "too_large", message_he: he.badImage } });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: { code: "bad_request", message_he: he.genericError } });
    console.error(err);
    return reply.code(500).send({ error: { code: "internal", message_he: he.genericError } });
  });

  const deps = { cfg, db, model };
  app.get("/api/health", async () => ({ ok: true, mockModel: !cfg.anthropicKey, db: db.kind }));
  authRoutes(app, deps);
  await app.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth(cfg.jwtSecret));
    plantRoutes(scoped, deps);
    aiRoutes(scoped, deps);
    miscRoutes(scoped, deps);
  });

  // הגשת ה-PWA הבנוי (פרודקשן)
  const dist = join(dirname(fileURLToPath(import.meta.url)), "../../dist");
  if (existsSync(dist)) {
    await app.register(fastifyStatic, { root: dist });
    app.setNotFoundHandler((req, reply) => (req.url.startsWith("/api/") ? reply.code(404).send({ error: { code: "not_found", message_he: he.notFound } }) : reply.sendFile("index.html")));
  }
  return app;
}
