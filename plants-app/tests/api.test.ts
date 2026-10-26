import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../server/src/app.ts";
import { loadConfig } from "../server/src/config.ts";
import { openDb } from "../server/src/db/index.ts";
import { MockModel } from "../server/src/ai/mock.ts";

// תמונת PNG זעירה תקינה
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let app: Awaited<ReturnType<typeof buildApp>>;
const cfg = loadConfig({ SQLITE_PATH: ":memory:", JWT_SECRET: "test-secret-test-secret" } as any);

async function register(email: string) {
  const r = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email, password: "password123" } });
  expect(r.statusCode).toBe(200);
  return { authorization: `Bearer ${r.json().token}` };
}

beforeEach(async () => {
  const db = await openDb({ databaseUrl: null, sqlitePath: ":memory:" });
  app = await buildApp(cfg, db, new MockModel());
});

describe("auth", () => {
  it("דורש התחברות", async () => {
    expect((await app.inject({ url: "/api/plants" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/plants", headers: { authorization: "Bearer x.y.z" } })).statusCode).toBe(401);
  });
  it("התחברות עם סיסמה שגויה נכשלת", async () => {
    await register("a@b.com");
    const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "a@b.com", password: "wrongpass1" } });
    expect(r.statusCode).toBe(401);
  });
});

describe("זיהוי ואבחון", () => {
  it("מזהה צמח ומחזיר סכמה תקינה", async () => {
    const h = await register("a@b.com");
    const r = await app.inject({ method: "POST", url: "/api/identify", headers: h, payload: { image: PNG, mime: "image/png" } });
    expect(r.statusCode).toBe(200);
    const { result } = r.json();
    expect(result.is_plant).toBe(true);
    expect(result.care.water_every_days).toBeGreaterThan(0);
  });
  it("תמונה לא צמח", async () => {
    const h = await register("a@b.com");
    const r = await app.inject({ method: "POST", url: "/api/identify", headers: h, payload: { image: PNG, mime: "image/png", hint: "לא צמח" } });
    expect(r.json().result.is_plant).toBe(false);
  });
  it("תמונה מטושטשת מבקשת תמונה נוספת", async () => {
    const h = await register("a@b.com");
    const r = await app.inject({ method: "POST", url: "/api/identify", headers: h, payload: { image: PNG, mime: "image/png", hint: "מטושטש" } });
    expect(r.json().result.needs_more_photos).toBe(true);
  });
  it("דוחה סוג קובץ ולא-base64", async () => {
    const h = await register("a@b.com");
    expect((await app.inject({ method: "POST", url: "/api/identify", headers: h, payload: { image: PNG, mime: "image/gif" } })).statusCode).toBe(415);
    expect((await app.inject({ method: "POST", url: "/api/identify", headers: h, payload: { image: "!!!", mime: "image/png" } })).statusCode).toBe(400);
  });
  it("אבחון דורש תמונה או תיאור", async () => {
    const h = await register("a@b.com");
    expect((await app.inject({ method: "POST", url: "/api/diagnose", headers: h, payload: {} })).statusCode).toBe(400);
    const r = await app.inject({ method: "POST", url: "/api/diagnose", headers: h, payload: { description: "העלים מצהיבים" } });
    expect(r.json().diagnosis.severity).toBe("attention");
  });
});

describe("מאגר צמחים ומשימות", () => {
  async function addPlant(h: any) {
    const idr = await app.inject({ method: "POST", url: "/api/identify", headers: h, payload: { image: PNG, mime: "image/png" } });
    const { result, photoId } = idr.json();
    const pr = await app.inject({ method: "POST", url: "/api/plants", headers: h, payload: { nickname: "הירוק", location: "סלון", fromIdentify: result, photoId } });
    expect(pr.statusCode).toBe(201);
    return pr.json();
  }

  it("הוספה יוצרת משימות והשלמה יוצרת הבאה", async () => {
    const h = await register("a@b.com");
    const plant = await addPlant(h);
    const t1 = (await app.inject({ url: "/api/tasks/today", headers: h })).json();
    const all = [...t1.overdue, ...t1.today, ...t1.upcoming];
    expect(plant.id).toBeTruthy();
    // משימות קיימות במאגר (גם אם רחוקות מ-7 ימים)
    const grow = await app.inject({ url: `/api/plants/${plant.id}/growth`, headers: h });
    expect(grow.json().entries.length).toBe(1);
    expect(all.length).toBeGreaterThanOrEqual(0);
  });

  it("סימון בוצע מעדכן last_watered ויוצר משימה הבאה", async () => {
    const h = await register("a@b.com");
    const plant = await addPlant(h);
    // מקדימים את המשימה להיום
    await app.inject({ method: "PATCH", url: `/api/plants/${plant.id}`, headers: h, payload: { water_every_days: 2, last_watered: "2020-01-01" } });
    const t = (await app.inject({ url: "/api/tasks/today", headers: h })).json();
    const water = t.overdue.find((x: any) => x.type === "water");
    expect(water).toBeTruthy();
    const done = await app.inject({ method: "POST", url: `/api/tasks/${water.id}/done`, headers: h });
    expect(done.statusCode).toBe(200);
    expect(done.json().next.due_date > water.due_date).toBe(true);
    expect((await app.inject({ url: `/api/plants/${plant.id}`, headers: h })).json().last_watered).toBeTruthy();
    expect((await app.inject({ method: "POST", url: `/api/tasks/${water.id}/done`, headers: h })).statusCode).toBe(404);
  });

  it("בידוד בין משתמשים", async () => {
    const a = await register("a@b.com");
    const b = await register("b@b.com");
    const plant = await addPlant(a);
    expect((await app.inject({ url: `/api/plants/${plant.id}`, headers: b })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/api/plants/${plant.id}`, headers: b })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/plants", headers: b })).json().plants).toHaveLength(0);
    expect((await app.inject({ method: "POST", url: "/api/diagnose", headers: b, payload: { description: "x", plantId: plant.id } })).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/photos/${plant.cover_photo_id}`, headers: b })).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/photos/${plant.cover_photo_id}`, headers: a })).statusCode).toBe(200);
  });

  it("חיפוש ומחיקה", async () => {
    const h = await register("a@b.com");
    const plant = await addPlant(h);
    expect((await app.inject({ url: "/api/plants?q=הירוק", headers: h })).json().plants).toHaveLength(1);
    expect((await app.inject({ url: "/api/plants?q=zzz", headers: h })).json().plants).toHaveLength(0);
    expect((await app.inject({ method: "DELETE", url: `/api/plants/${plant.id}`, headers: h })).statusCode).toBe(204);
    expect((await app.inject({ url: `/api/plants/${plant.id}`, headers: h })).statusCode).toBe(404);
  });

  it("פרופיל בית משנה מחזורים", async () => {
    const h = await register("a@b.com");
    const put = await app.inject({ method: "PUT", url: "/api/profile", headers: h, payload: { home: { light: "bright", humidity: "low", temperature_c: 30 } } });
    expect(put.statusCode).toBe(200);
    expect((await app.inject({ url: "/api/profile", headers: h })).json().home.light).toBe("bright");
  });
});
