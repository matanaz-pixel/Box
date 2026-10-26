import type { HomeProfile } from "./schemas.ts";

export const DAY_MS = 86_400_000;

/** התאמת מחזור השקיה/הזנה לתנאי הבית. פונקציה טהורה. */
export function adjustInterval(base: number, home: Partial<HomeProfile> | undefined, now = new Date()): number {
  let factor = 1;
  if (home?.light === "bright") factor -= 0.15;
  if (home?.light === "low") factor += 0.15;
  if (home?.humidity === "low") factor -= 0.1;
  if (home?.humidity === "high") factor += 0.1;
  if ((home?.temperature_c ?? 24) > 26) factor -= 0.1;
  const month = now.getMonth(); // 0=ינואר
  if (month === 11 || month <= 1) factor += 0.25; // חורף
  return Math.min(60, Math.max(2, Math.round(base * factor)));
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  return isoDate(new Date(d.getTime() + days * DAY_MS));
}

/** מועד המשימה הבאה: מהפעם האחרונה, או היום+מחזור אם אין. */
export function nextDueDate(last: string | null | undefined, interval: number, today: string): string {
  return last ? addDays(last, interval) : addDays(today, interval);
}
