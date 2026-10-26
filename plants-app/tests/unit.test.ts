import { describe, expect, it } from "vitest";
import { addDays, adjustInterval, nextDueDate } from "../shared/care.ts";
import { identifyResultSchema } from "../shared/schemas.ts";
import { ModelFailedError, parseModelJson, groundIdentify } from "../server/src/ai/model.ts";
import { MockModel } from "../server/src/ai/mock.ts";
import { validateImage } from "../server/src/util.ts";
import { hashPassword, signToken, verifyPassword, verifyToken } from "../server/src/auth.ts";

describe("adjustInterval", () => {
  const summer = new Date("2026-07-15");
  it("אור חזק, לחות נמוכה וחום מקצרים", () => {
    expect(adjustInterval(10, { light: "bright", humidity: "low", temperature_c: 30 }, summer)).toBe(7);
  });
  it("חורף מאריך", () => {
    expect(adjustInterval(10, {}, new Date("2026-01-10"))).toBe(13);
  });
  it("חסום בין 2 ל-60", () => {
    expect(adjustInterval(1, { light: "bright", humidity: "low" }, summer)).toBe(2);
    expect(adjustInterval(200, {}, summer)).toBe(60);
  });
});

describe("תאריכים", () => {
  it("addDays ו-nextDueDate", () => {
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
    expect(nextDueDate("2026-01-01", 5, "2026-06-01")).toBe("2026-01-06");
    expect(nextDueDate(null, 5, "2026-06-01")).toBe("2026-06-06");
  });
});

describe("פרסור פלט מודל", () => {
  it("JSON שבור וסכמה שגויה נכשלים", () => {
    expect(() => parseModelJson("not json", identifyResultSchema)).toThrow(ModelFailedError);
    expect(() => parseModelJson("{}", identifyResultSchema)).toThrow(ModelFailedError);
  });
  it("פלט תקין של המדומה עובר", async () => {
    const r = await new MockModel().identify({ image: { base64: "AAAA" } });
    expect(parseModelJson(JSON.stringify(r), identifyResultSchema).is_plant).toBe(true);
  });
  it("עיגון ברעילות משלים unknown ממאגר הידע", async () => {
    const r = await new MockModel().identify({ image: { base64: "AAAA" } });
    const g = groundIdentify({ ...r, common_name_he: "פוטוס", scientific_name: "Epipremnum aureum", toxicity: { cats: "unknown", dogs: "safe", children: "unknown", details_he: "" } });
    expect(g.toxicity.cats).toBe("toxic");
    expect(g.toxicity.dogs).toBe("safe");
  });
});

describe("ולידציית תמונה", () => {
  it("סוגים וגודל", () => {
    expect(validateImage("AAAA", "image/png").mime).toBe("image/png");
    expect(() => validateImage("AAAA", "text/html")).toThrow();
    expect(() => validateImage("A".repeat(9_000_000), "image/png")).toThrow();
    expect(validateImage("data:image/png;base64,AAAA", "image/png").base64).toBe("AAAA");
  });
});

describe("אימות", () => {
  it("סיסמה וטוקן", async () => {
    const h = await hashPassword("secret123");
    expect(await verifyPassword("secret123", h)).toBe(true);
    expect(await verifyPassword("nope", h)).toBe(false);
    const t = signToken("u1", "s");
    expect(verifyToken(t, "s")).toBe("u1");
    expect(verifyToken(t, "other")).toBeNull();
    expect(verifyToken(signToken("u1", "s", -10), "s")).toBeNull();
  });
});
