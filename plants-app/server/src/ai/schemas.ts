import { z } from "zod";
import { diagnoseResultSchema, identifyResultSchema } from "../../../shared/schemas.ts";

// JSON Schema לפלט מובנה של המודל (output_config.format)
export const identifyJsonSchema = z.toJSONSchema(identifyResultSchema, { target: "draft-7" }) as Record<string, unknown>;
export const diagnoseJsonSchema = z.toJSONSchema(diagnoseResultSchema, { target: "draft-7" }) as Record<string, unknown>;
