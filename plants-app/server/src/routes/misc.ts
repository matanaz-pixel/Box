import type { FastifyInstance } from "fastify";
import { homeProfileSchema } from "../../../shared/schemas.ts";
import { he } from "../../../shared/he.ts";
import { addDays } from "../../../shared/care.ts";
import { getHome, markTaskDone, rescheduleTasks } from "../repo.ts";
import { HttpError, parseJson, today } from "../util.ts";
import type { Deps } from "./ctx.ts";

export function miscRoutes(app: FastifyInstance, { db, cfg }: Deps) {
  app.get("/api/tasks/today", async (req) => {
    const t = today();
    const rows = await db.all<any>(
      `select c.*, p.nickname, p.common_name_he, p.cover_photo_id from care_tasks c join plants p on p.id = c.plant_id
       where c.user_id = ? and c.done_at is null order by c.due_date`, [req.userId]);
    const week = addDays(t, 7);
    return {
      overdue: rows.filter((r) => r.due_date < t),
      today: rows.filter((r) => r.due_date === t),
      upcoming: rows.filter((r) => r.due_date > t && r.due_date <= week),
    };
  });

  app.post("/api/tasks/:id/done", async (req) => {
    const r = await markTaskDone(db, req.userId, (req.params as any).id);
    if (!r) throw new HttpError(404, "not_found", he.notFound);
    return r;
  });

  app.get("/api/profile", async (req) => ({ home: homeProfileSchema.parse(await getHome(db, req.userId)) }));

  app.put("/api/profile", async (req) => {
    const b = homeProfileSchema.safeParse((req.body as any)?.home ?? {});
    if (!b.success) throw new HttpError(400, "bad_request", "נתונים לא תקינים.");
    await db.run("insert into profiles(user_id, home) values(?,?) on conflict(user_id) do update set home = excluded.home", [req.userId, JSON.stringify(b.data)]);
    // תנאי הבית משפיעים על המחזורים
    for (const p of await db.all<{ id: string }>("select id from plants where user_id = ?", [req.userId])) await rescheduleTasks(db, req.userId, p.id);
    return { home: b.data };
  });

  app.get("/api/push/vapid-key", async () => ({ key: cfg.vapid?.publicKey ?? null }));

  app.post("/api/push/subscribe", async (req) => {
    const sub = (req.body as any)?.subscription;
    if (!sub || typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://")) throw new HttpError(400, "bad_request", "מנוי לא תקין.");
    const r = await db.get<any>("select push_subs from profiles where user_id = ?", [req.userId]);
    const subs = parseJson<any[]>(r?.push_subs, []).filter((s) => s.endpoint !== sub.endpoint);
    subs.push(sub);
    await db.run("insert into profiles(user_id, push_subs) values(?,?) on conflict(user_id) do update set push_subs = excluded.push_subs", [req.userId, JSON.stringify(subs.slice(-5))]);
    return { ok: true };
  });
}
