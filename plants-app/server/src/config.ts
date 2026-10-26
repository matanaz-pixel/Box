import { randomBytes } from "node:crypto";

export interface Config {
  port: number;
  anthropicKey: string | null;
  modelId: string;
  databaseUrl: string | null;
  sqlitePath: string;
  jwtSecret: string;
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  signupCode: string | null;
  isProd: boolean;
  corsOrigin: string | boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const isProd = env.NODE_ENV === "production";
  let jwtSecret = env.JWT_SECRET ?? "";
  if (!jwtSecret) {
    if (isProd) throw new Error("JWT_SECRET is required in production");
    jwtSecret = randomBytes(32).toString("hex"); // פיתוח: סשנים נמחקים באתחול
  }
  const vapid =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
      ? { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT ?? "mailto:admin@example.com" }
      : null;
  return {
    port: Number(env.PORT ?? 8787),
    anthropicKey: env.ANTHROPIC_API_KEY || null,
    modelId: env.MODEL_ID || "claude-opus-5-5",
    databaseUrl: env.DATABASE_URL || null,
    sqlitePath: env.SQLITE_PATH || "./data/dev.db",
    jwtSecret,
    vapid,
    signupCode: env.SIGNUP_CODE || null,
    isProd,
    corsOrigin: env.CORS_ORIGIN ?? !isProd,
  };
}
