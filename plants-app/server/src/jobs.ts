import webpush from "web-push";
import type { Config } from "./config.ts";
import type { Db } from "./db/index.ts";
import { nowIso, parseJson, today } from "./util.ts";

/** שולח התראות למשימות שהגיע זמנן ולא נשלחה עליהן התראה. */
export async function sendDueReminders(db: Db, cfg: Config, now = new Date()): Promise<number> {
  if (!cfg.vapid) return 0;
  webpush.setVapidDetails(cfg.vapid.subject, cfg.vapid.publicKey, cfg.vapid.privateKey);
  const tasks = await db.all<any>(
    `select c.id, c.user_id, c.type, p.nickname from care_tasks c join plants p on p.id = c.plant_id
     where c.done_at is null and c.notified_at is null and c.due_date <= ?`, [today()]);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(now));
  if (hour < 9) return 0;
  let sent = 0;
  for (const t of tasks) {
    const prof = await db.get<any>("select push_subs from profiles where user_id = ?", [t.user_id]);
    const subs = parseJson<any[]>(prof?.push_subs, []);
    const alive: any[] = [];
    const body = JSON.stringify({ title: "הג'ונגל שלי", body: `${t.nickname}: ${t.type === "water" ? "הגיע הזמן להשקות" : "הגיע הזמן לדשן"}` });
    for (const s of subs) {
      try { await webpush.sendNotification(s, body); alive.push(s); sent++; }
      catch (e: any) { if (e?.statusCode !== 404 && e?.statusCode !== 410) alive.push(s); }
    }
    if (alive.length !== subs.length) await db.run("update profiles set push_subs = ? where user_id = ?", [JSON.stringify(alive), t.user_id]);
    await db.run("update care_tasks set notified_at = ? where id = ?", [nowIso(), t.id]);
  }
  return sent;
}

export function startJobs(db: Db, cfg: Config) {
  if (!cfg.vapid) return;
  setInterval(() => sendDueReminders(db, cfg).catch((e) => console.error("reminders", e)), 15 * 60_000).unref();
}
