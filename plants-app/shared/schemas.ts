import { z } from "zod";

// הסכמות כאן משמשות גם כפלט מובנה למודל וגם לוולידציה בשרת.
// בכוונה בלי min/max על מספרים: הערכים נחתכים לטווח אחרי הפרסור.

export const toxicityLevel = z.enum(["toxic", "mildly_toxic", "safe", "unknown"]);

export const toxicitySchema = z.object({
  cats: toxicityLevel,
  dogs: toxicityLevel,
  children: toxicityLevel,
  details_he: z.string(),
});

export const careSchema = z.object({
  light: z.string(),
  watering: z.string(),
  humidity: z.string(),
  temperature: z.string(),
  soil: z.string(),
  feeding: z.string(),
  water_every_days: z.number().int(),
  feed_every_days: z.number().int(),
});

export const identifyResultSchema = z.object({
  is_plant: z.boolean(),
  image_quality: z.enum(["good", "blurry", "dark", "partial"]),
  confidence: z.number(),
  common_name_he: z.string(),
  scientific_name: z.string(),
  alternatives: z.array(
    z.object({
      common_name_he: z.string(),
      scientific_name: z.string(),
      confidence: z.number(),
      distinguishing_note_he: z.string(),
    }),
  ),
  needs_more_photos: z.boolean(),
  request_he: z.string(),
  care: careSchema,
  toxicity: toxicitySchema,
  notes_he: z.string(),
});

export const diagnoseResultSchema = z.object({
  is_plant: z.boolean(),
  plant_guess_he: z.string(),
  severity: z.enum(["ok", "attention", "urgent"]),
  confidence: z.number(),
  causes: z.array(
    z.object({ name_he: z.string(), likelihood: z.number(), evidence_he: z.string() }),
  ),
  steps_he: z.array(z.string()),
  follow_up_he: z.array(z.string()),
  need_more_info_he: z.array(z.string()),
  disclaimer_he: z.string(),
});

export type IdentifyResult = z.infer<typeof identifyResultSchema>;
export type DiagnoseResult = z.infer<typeof diagnoseResultSchema>;
export type Toxicity = z.infer<typeof toxicitySchema>;
export type Care = z.infer<typeof careSchema>;

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function normalizeIdentify(r: IdentifyResult): IdentifyResult {
  return {
    ...r,
    confidence: clamp01(r.confidence),
    alternatives: r.alternatives.slice(0, 3).map((a) => ({ ...a, confidence: clamp01(a.confidence) })),
    care: {
      ...r.care,
      water_every_days: Math.min(60, Math.max(1, r.care.water_every_days || 7)),
      feed_every_days: Math.min(120, Math.max(7, r.care.feed_every_days || 30)),
    },
  };
}

export function normalizeDiagnose(r: DiagnoseResult): DiagnoseResult {
  return {
    ...r,
    confidence: clamp01(r.confidence),
    causes: r.causes.slice(0, 4).map((c) => ({ ...c, likelihood: clamp01(c.likelihood) })),
  };
}

export const homeProfileSchema = z.object({
  windows: z.array(z.enum(["north", "south", "east", "west"])).default([]),
  light: z.enum(["low", "medium", "bright"]).default("medium"),
  temperature_c: z.number().default(24),
  humidity: z.enum(["low", "medium", "high"]).default("medium"),
  has_pets: z.boolean().default(false),
  has_children: z.boolean().default(false),
});
export type HomeProfile = z.infer<typeof homeProfileSchema>;
