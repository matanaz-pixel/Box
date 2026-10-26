import { adjustInterval, addDays, nextDueDate } from "../../shared/care.ts";
import type { HomeProfile } from "../../shared/schemas.ts";
import type { Db } from "./db/index.ts";
import { nowIso, parseJson, today, uid } from "./util.ts";

export async function getHome(db: Db, userId: string): Promise<Partial<HomeProfile>> {
  const r = await db.get<{ home: string }>("select home from profiles where user_id = ?", [userId]);
  return parseJson(r?.home, {});
}

export function plantOut(row: Record<string, any>): Record<string, any> {
  return { ...row, care: parseJson(row.care, null), toxicity: parseJson(row.toxicity, null) };
}

/** מחזור אפקטיבי לצמח: בסיס מותאם לתנאי הבית. */
export function effectiveInterval(base: number | null | undefined, home: Partial<HomeProfile>): number | null {
  return base ? adjustInterval(base, home) : null;
}

/** יוצר/מחליף משימות פתוחות לצמח לפי המחזורים וההשקיה האחרונה. */
export async function rescheduleTasks(db: Db, userId: string, plantId: string): Promise<void> {
  const p = await db.get<any>("select * from plants where id = ? and user_id = ?", [plantId, userId]);
  if (!p) return;
  const home = await getHome(db, userId);
  await db.run("delete from care_tasks where plant_id = ? and user_id = ? and done_at is null", [plantId, userId]);
  const t = today();
  for (const [type, base, last] of [["water", p.water_every_days, p.last_watered], ["feed", p.feed_every_days, p.last_fed]] as const) {
    const iv = effectiveInterval(base, home);
    if (!iv) continue;
    await db.run("insert into care_tasks(id, user_id, plant_id, type, due_date) values(?,?,?,?,?)", [uid(), userId, plantId, type, nextDueDate(last, iv, t)]);
  }
}

export async function markTaskDone(db: Db, userId: string, taskId: string) {
  const task = await db.get<any>("select * from care_tasks where id = ? and user_id = ?", [taskId, userId]);
  if (!task || task.done_at) return null;
  const t = today();
  await db.run("update care_tasks set done_at = ? where id = ?", [nowIso(), taskId]);
  const col = task.type === "water" ? "last_watered" : "last_fed";
  await db.run(`update plants set ${col} = ? where id = ? and user_id = ?`, [t, task.plant_id, userId]);
  const p = await db.get<any>("select * from plants where id = ?", [task.plant_id]);
  const home = await getHome(db, userId);
  const iv = effectiveInterval(task.type === "water" ? p?.water_every_days : p?.feed_every_days, home);
  let next = null;
  if (iv) {
    const id = uid();
    await db.run("insert into care_tasks(id, user_id, plant_id, type, due_date) values(?,?,?,?,?)", [id, userId, task.plant_id, task.type, addDays(t, iv)]);
    next = await db.get("select * from care_tasks where id = ?", [id]);
  }
  return { task: { ...task, done_at: nowIso() }, next };
}
