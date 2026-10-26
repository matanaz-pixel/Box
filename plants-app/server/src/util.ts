import { randomUUID } from "node:crypto";
import { he } from "../../shared/he.ts";

export const uid = () => randomUUID();
export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class HttpError extends Error {
  constructor(public status: number, public code: string, public messageHe: string) { super(code); }
}

/** בדיקת base64 של תמונה: סוג, גודל ותקינות. */
export function validateImage(base64: unknown, mime: unknown): { base64: string; mime: string } {
  if (typeof base64 !== "string" || typeof mime !== "string") throw new HttpError(400, "bad_image", he.badImage);
  if (!MIMES.has(mime)) throw new HttpError(415, "unsupported_media", he.badImage);
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]+=*$/.test(clean)) throw new HttpError(400, "bad_image", he.badImage);
  if (Math.floor((clean.length * 3) / 4) > MAX_IMAGE_BYTES) throw new HttpError(413, "too_large", he.badImage);
  return { base64: clean, mime };
}

export const parseJson = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};
