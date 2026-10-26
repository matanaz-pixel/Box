import { createHash } from "node:crypto";
import { he } from "../../../shared/he.ts";
import { normalizeDiagnose, normalizeIdentify, type DiagnoseResult, type IdentifyResult } from "../../../shared/schemas.ts";
import { KNOWLEDGE } from "./knowledge.ts";
import type { PlantModel } from "./model.ts";

const emptyCare = { light: "", watering: "", humidity: "", temperature: "", soil: "", feeding: "", water_every_days: 7, feed_every_days: 30 };

/** מודל מדומה לפיתוח ולבדיקות: דטרמיניסטי לפי תוכן. */
export class MockModel implements PlantModel {
  async identify({ image, hint }: { image: { base64: string }; hint?: string }): Promise<IdentifyResult> {
    const h = hint ?? "";
    if (/לא צמח|not-a-plant/.test(h)) {
      return normalizeIdentify({ is_plant: false, image_quality: "good", confidence: 0, common_name_he: "", scientific_name: "", alternatives: [], needs_more_photos: false, request_he: "", care: emptyCare, toxicity: { cats: "unknown", dogs: "unknown", children: "unknown", details_he: "" }, notes_he: "בתמונה לא נראה צמח." });
    }
    const idx = parseInt(createHash("sha1").update(image.base64).digest("hex").slice(0, 6), 16) % KNOWLEDGE.length;
    const k = KNOWLEDGE[idx]!;
    const low = /מטושטש|blurry/.test(h);
    const alt = KNOWLEDGE[(idx + 1) % KNOWLEDGE.length]!;
    return normalizeIdentify({
      is_plant: true, image_quality: low ? "blurry" : "good", confidence: low ? 0.45 : 0.9,
      common_name_he: k.he, scientific_name: k.sci,
      alternatives: low ? [{ common_name_he: alt.he, scientific_name: alt.sci, confidence: 0.3, distinguishing_note_he: "שימו לב לצורת העלה." }] : [],
      needs_more_photos: low, request_he: low ? "צלמו את העלה מקרוב באור יום." : "",
      care: { light: k.light, watering: `השקיה כל ${k.water} ימים בערך, לאחר שהשכבה העליונה יבשה.`, humidity: "לחות רגילה לבית", temperature: "18–28 מעלות", soil: "אדמה מנוקזת היטב", feeding: `דישון כל ${k.feed} ימים באביב ובקיץ.`, water_every_days: k.water, feed_every_days: k.feed },
      toxicity: { cats: k.cats as any, dogs: k.dogs as any, children: k.children as any, details_he: `${k.tox} ${he.disclaimer}` },
      notes_he: "תוצאה ממודל מדומה (פיתוח).",
    });
  }

  async diagnose({ description = "", image }: { description?: string; image?: unknown }): Promise<DiagnoseResult> {
    const d = description;
    const urgent = /ריקב|רקב|מתפשט|rot/.test(d);
    const bad = urgent || /צהוב|מצהיב|נבול|כתמים|חום|יבש|רטוב/.test(d) || (!!image && !d);
    return normalizeDiagnose({
      is_plant: true, plant_guess_he: "", severity: urgent ? "urgent" : bad ? "attention" : "ok", confidence: bad ? 0.7 : 0.8,
      causes: bad ? [{ name_he: "השקיית יתר", likelihood: 0.6, evidence_he: "עלים צהובים ואדמה רטובה מרמזים על עודף מים." }, { name_he: "חוסר אור", likelihood: 0.25, evidence_he: "ייתכן שהמיקום חשוך מדי." }] : [],
      steps_he: bad ? ["בדקו את לחות האדמה באצבע לעומק 3 ס\"מ.", "אפשרו לאדמה להתייבש לפני ההשקיה הבאה.", "הסירו עלים פגועים."] : ["הצמח נראה תקין, המשיכו כרגיל."],
      follow_up_he: ["צלמו שוב בעוד שבוע והשוו."], need_more_info_he: bad ? ["כל כמה זמן משקים?"] : [],
      disclaimer_he: he.disclaimer,
    });
  }
}
