import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import {
  diagnoseResultSchema, identifyResultSchema, normalizeDiagnose, normalizeIdentify,
  type DiagnoseResult, type IdentifyResult,
} from "../../../shared/schemas.ts";
import type { Config } from "../config.ts";
import { DIAGNOSE_SYSTEM, IDENTIFY_SYSTEM, diagnoseUserText, identifyUserText } from "./prompts.ts";
import { diagnoseJsonSchema, identifyJsonSchema } from "./schemas.ts";
import { findKnowledge } from "./knowledge.ts";
import { MockModel } from "./mock.ts";

export interface ImageInput { mime: string; base64: string }

export class ModelRefusalError extends Error {}
export class ModelFailedError extends Error {}

export interface PlantModel {
  identify(i: { image: ImageInput; hint?: string }): Promise<IdentifyResult>;
  diagnose(i: { image?: ImageInput; description?: string; plant?: Record<string, unknown> | null; home?: Record<string, unknown> | null }): Promise<DiagnoseResult>;
}

/** פרסור תשובת מודל: JSON תקין + ולידציית zod. זורק על כשל. */
export function parseModelJson<T>(text: string, schema: ZodType<T>): T {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new ModelFailedError("invalid JSON"); }
  const r = schema.safeParse(raw);
  if (!r.success) throw new ModelFailedError("schema violation");
  return r.data;
}

export class AnthropicModel implements PlantModel {
  private client: Anthropic;
  constructor(private cfg: Pick<Config, "anthropicKey" | "modelId">) {
    this.client = new Anthropic({ apiKey: cfg.anthropicKey! });
  }

  private async ask<T>(system: string, content: Anthropic.ContentBlockParam[], jsonSchema: Record<string, unknown>, schema: ZodType<T>): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.client.messages.create({
        model: this.cfg.modelId,
        max_tokens: 4000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "low", format: { type: "json_schema", schema: jsonSchema } },
        messages: [{ role: "user", content }],
      } as any);
      if (res.stop_reason === "refusal") throw new ModelRefusalError("refusal");
      const text = res.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
      try { return parseModelJson(text, schema); } catch (e) { if (attempt === 1) throw e; }
    }
    throw new ModelFailedError("unreachable");
  }

  private img(i: ImageInput): Anthropic.ContentBlockParam {
    return { type: "image", source: { type: "base64", media_type: i.mime as any, data: i.base64 } };
  }

  async identify(i: { image: ImageInput; hint?: string }) {
    const r = await this.ask(IDENTIFY_SYSTEM, [this.img(i.image), { type: "text", text: identifyUserText(i.hint) }], identifyJsonSchema, identifyResultSchema);
    return groundIdentify(normalizeIdentify(r));
  }

  async diagnose(i: Parameters<PlantModel["diagnose"]>[0]) {
    const content: Anthropic.ContentBlockParam[] = [];
    if (i.image) content.push(this.img(i.image));
    content.push({ type: "text", text: diagnoseUserText(i) });
    return normalizeDiagnose(await this.ask(DIAGNOSE_SYSTEM, content, diagnoseJsonSchema, diagnoseResultSchema));
  }
}

/** עיגון בבסיס הידע: אם המודל לא בטוח ברעילות, משלימים ממאגר הידע. */
export function groundIdentify(r: IdentifyResult): IdentifyResult {
  const k = findKnowledge(r.common_name_he, r.scientific_name);
  if (!k || !r.is_plant) return r;
  const t = { ...r.toxicity };
  for (const key of ["cats", "dogs", "children"] as const) {
    if (t[key] === "unknown") t[key] = k[key] as any;
  }
  if (!t.details_he) t.details_he = k.tox;
  return { ...r, toxicity: t };
}

export function createModel(cfg: Config): PlantModel {
  return cfg.anthropicKey ? new AnthropicModel(cfg) : new MockModel();
}
