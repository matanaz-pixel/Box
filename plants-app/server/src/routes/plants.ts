import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { he } from "../../../shared/he.ts";
import { identifyResultSchema } from "../../../shared/schemas.ts";
import { plantOut, rescheduleTasks } from "../repo.ts";
import { HttpError, nowIso, parseJson, uid, validateImage } from "../util.ts";
import type { Deps } from "./ctx.ts";

const createBody = z.object({
  nickname: z.string().trim().min(1).max(80),
  location: z.string().trim().max(80).optional(),
  notes: z.string().max(2000).optional(),
  fromIdentify: identifyResultSchema.optional(),
  photoId: z.string().optional(),
  common_name_he: z.string().max(120).optional(),
  scientific_name: z.string().max(120).optional(),
  water_every_days: z.number().int().min(1).max(90).optional(),
  feed_every_days: z.number().int().min(1).max(365).optional(),
});

const patchBody = z.object({
  nickname: z.string().trim().min(1).max(80),
  location: z.string().trim().max(80).nullable(),
  notes: z.string().max(2000).nullable(),
  water_every_days: z.number().int().min(1).max(90).nullable(),
  feed_every_days: z.number().int().min(1).max(365).nullable(),
  last_watered: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  last_fed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  cover_photo_id: z.string().nullable(),
}).partial();

export function plantRoutes(app: FastifyInstance, { db }: Deps) {
  const bad = (msg = "נתונים לא תקינים.") => new HttpError(400, "bad_request", msg);
  const own = async (userId: string, id: string) => {
    const p = await db.get<any>("select * from plants where id = ? and user_id = ?", [id, userId]);
    if (!p) throw new HttpError(404, "not_found", he.notFound);
    return p;
  };

  app.get("/api/plants", async (req) => {
    const q = (req.query ?? {}) as { q?: string; location?: string };
    const rows = await db.all<any>("select * from plants where user_id = ? order by created_at desc", [req.userId]);
    const needle = q.q?.trim().toLowerCase();
    return {
      plants: rows.map(plantOut).filter((p) =>
        (!q.location || p.location === q.location) &&
        (!needle || [p.nickname, p.common_name_he, p.scientific_name].some((s) => s?.toLowerCase().includes(needle)))),
    };
  });

  app.post("/api/plants", async (req, reply) => {
    const b = createBody.safeParse(req.body);
    if (!b.success) throw bad();
    const f = b.data.fromIdentify;
    const id = uid();
    if (b.data.photoId) {
      const ph = await db.get("select 1 as x from photos where id = ? and user_id = ?", [b.data.photoId, req.userId]);
      if (!ph) throw bad();
    }
    await db.run(
      `insert into plants(id, user_id, nickname, common_name_he, scientific_name, location, notes, care, toxicity,
         water_every_days, feed_every_days, cover_photo_id, created_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, req.userId, b.data.nickname, f?.common_name_he ?? b.data.common_name_he ?? null, f?.scientific_name ?? b.data.scientific_name ?? null,
        b.data.location ?? null, b.data.notes ?? null, f ? JSON.stringify(f.care) : null, f ? JSON.stringify(f.toxicity) : null,
        f?.care.water_every_days ?? b.data.water_every_days ?? null, f?.care.feed_every_days ?? b.data.feed_every_days ?? null,
        b.data.photoId ?? null, nowIso()],
    );
    if (b.data.photoId) {
      await db.run("update photos set plant_id = ? where id = ?", [id, b.data.photoId]);
      await db.run("insert into growth_entries(id, user_id, plant_id, photo_id, note, created_at) values(?,?,?,?,?,?)", [uid(), req.userId, id, b.data.photoId, "התחלה", nowIso()]);
    }
    await rescheduleTasks(db, req.userId, id);
    reply.code(201);
    return plantOut(await own(req.userId, id));
  });

  app.get("/api/plants/:id", async (req) => plantOut(await own(req.userId, (req.params as any).id)));

  app.patch("/api/plants/:id", async (req) => {
    const id = (req.params as any).id as string;
    await own(req.userId, id);
    const b = patchBody.safeParse(req.body);
    if (!b.success) throw bad();
    const entries = Object.entries(b.data);
    if (entries.length) {
      if (b.data.cover_photo_id) {
        const ph = await db.get("select 1 as x from photos where id = ? and user_id = ?", [b.data.cover_photo_id, req.userId]);
        if (!ph) throw bad();
      }
      await db.run(`update plants set ${entries.map(([k]) => `${k} = ?`).join(", ")} where id = ? and user_id = ?`, [...entries.map(([, v]) => v), id, req.userId]);
      if ("water_every_days" in b.data || "feed_every_days" in b.data || "last_watered" in b.data || "last_fed" in b.data)
        await rescheduleTasks(db, req.userId, id);
    }
    return plantOut(await own(req.userId, id));
  });

  app.delete("/api/plants/:id", async (req, reply) => {
    const id = (req.params as any).id as string;
    await own(req.userId, id);
    for (const t of ["care_tasks", "growth_entries", "diagnoses", "photos"]) await db.run(`delete from ${t} where plant_id = ? and user_id = ?`, [id, req.userId]);
    await db.run("delete from plants where id = ? and user_id = ?", [id, req.userId]);
    return reply.code(204).send();
  });

  app.post("/api/plants/:id/photos", async (req, reply) => {
    const id = (req.params as any).id as string;
    await own(req.userId, id);
    const b = (req.body ?? {}) as any;
    const img = validateImage(b.image, b.mime);
    const photoId = uid();
    await db.run("insert into photos(id, user_id, plant_id, kind, mime, data, created_at) values(?,?,?,?,?,?,?)", [photoId, req.userId, id, "growth", img.mime, img.base64, nowIso()]);
    const entryId = uid();
    const note = typeof b.note === "string" ? b.note.slice(0, 500) : null;
    await db.run("insert into growth_entries(id, user_id, plant_id, photo_id, note, created_at) values(?,?,?,?,?,?)", [entryId, req.userId, id, photoId, note, nowIso()]);
    reply.code(201);
    return { photoId, entryId };
  });

  app.get("/api/plants/:id/growth", async (req) => {
    const id = (req.params as any).id as string;
    await own(req.userId, id);
    const entries = await db.all("select * from growth_entries where plant_id = ? and user_id = ? order by created_at desc", [id, req.userId]);
    const diagnoses = (await db.all<any>("select * from diagnoses where plant_id = ? and user_id = ? order by created_at desc", [id, req.userId])).map((d) => ({ ...d, result: parseJson(d.result, null) }));
    return { entries, diagnoses };
  });

  app.get("/api/photos/:id", async (req, reply) => {
    const p = await db.get<any>("select mime, data from photos where id = ? and user_id = ?", [(req.params as any).id, req.userId]);
    if (!p) throw new HttpError(404, "not_found", he.notFound);
    return reply.header("cache-control", "private, max-age=86400").type(p.mime).send(Buffer.from(p.data, "base64"));
  });
}
