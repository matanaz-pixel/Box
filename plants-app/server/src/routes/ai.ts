import type { FastifyInstance } from "fastify";
import { he } from "../../../shared/he.ts";
import { ModelRefusalError } from "../ai/model.ts";
import { getHome, plantOut } from "../repo.ts";
import { HttpError, nowIso, uid, validateImage } from "../util.ts";
import type { Deps } from "./ctx.ts";

async function savePhoto(db: Deps["db"], userId: string, kind: string, img: { base64: string; mime: string }, plantId: string | null = null) {
  const id = uid();
  await db.run("insert into photos(id, user_id, plant_id, kind, mime, data, created_at) values(?,?,?,?,?,?,?)", [id, userId, plantId, kind, img.mime, img.base64, nowIso()]);
  return id;
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e instanceof ModelRefusalError) throw new HttpError(422, "refusal", he.refusal);
    throw new HttpError(502, "model_failed", he.modelFailed);
  }
}

export function aiRoutes(app: FastifyInstance, { db, model }: Deps) {
  const rl = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

  app.post("/api/identify", rl, async (req) => {
    const b = (req.body ?? {}) as any;
    const img = validateImage(b.image, b.mime);
    const hint = typeof b.hint === "string" ? b.hint.slice(0, 500) : undefined;
    const result = await guard(() => model.identify({ image: img, hint }));
    const photoId = await savePhoto(db, req.userId, "identify", img);
    return { result, photoId };
  });

  app.post("/api/diagnose", rl, async (req) => {
    const b = (req.body ?? {}) as any;
    const description = typeof b.description === "string" ? b.description.trim().slice(0, 2000) : "";
    const img = b.image ? validateImage(b.image, b.mime) : undefined;
    if (!img && !description) throw new HttpError(400, "need_input", he.needInput);
    let plantRow: any = null;
    if (b.plantId) {
      plantRow = await db.get("select * from plants where id = ? and user_id = ?", [String(b.plantId), req.userId]);
      if (!plantRow) throw new HttpError(404, "not_found", he.notFound);
    }
    const plant = plantRow ? (({ nickname, common_name_he, scientific_name, location, last_watered, last_fed, notes }) => ({ nickname, common_name_he, scientific_name, location, last_watered, last_fed, notes }))(plantRow) : null;
    const home = await getHome(db, req.userId);
    const diagnosis = await guard(() => model.diagnose({ image: img, description, plant, home }));
    const photoId = img ? await savePhoto(db, req.userId, "diagnose", img, plantRow?.id ?? null) : null;
    const id = uid();
    if (plantRow) {
      await db.run("insert into diagnoses(id, user_id, plant_id, photo_id, description, result, severity, created_at) values(?,?,?,?,?,?,?,?)", [id, req.userId, plantRow.id, photoId, description || null, JSON.stringify(diagnosis), diagnosis.severity, nowIso()]);
      await db.run("insert into growth_entries(id, user_id, plant_id, photo_id, note, diagnosis_id, created_at) values(?,?,?,?,?,?,?)", [uid(), req.userId, plantRow.id, photoId, null, id, nowIso()]);
    }
    return { diagnosis, id: plantRow ? id : null, photoId };
  });
}
