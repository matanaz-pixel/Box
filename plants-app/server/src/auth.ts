import { createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyReply, FastifyRequest } from "fastify";
import { he } from "../../shared/he.ts";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [s, k] = stored.split(":");
  if (!s || !k) return false;
  const key = await scrypt(pw, Buffer.from(s, "hex"), 64);
  const expected = Buffer.from(k, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signToken(userId: string, secret: string, ttlSec = 60 * 60 * 24 * 30): string {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + ttlSec, jti: randomUUID() }));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verifyToken(token: string, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts as [string, string, string];
  const expected = createHmac("sha256", secret).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof p.sub !== "string" || p.exp < Date.now() / 1000) return null;
    return p.sub;
  } catch { return null; }
}

declare module "fastify" {
  interface FastifyRequest { userId: string }
}

export function requireAuth(secret: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const h = req.headers.authorization ?? "";
    const uid = h.startsWith("Bearer ") ? verifyToken(h.slice(7), secret) : null;
    if (!uid) return reply.code(401).send({ error: { code: "unauthorized", message_he: he.unauthorized } });
    req.userId = uid;
  };
}
