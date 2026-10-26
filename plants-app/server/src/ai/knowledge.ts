import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export interface KnowledgeEntry {
  he: string; sci: string; water: number; feed: number; light: string;
  cats: string; dogs: string; children: string; tox: string;
}

const here = dirname(fileURLToPath(import.meta.url));
export const KNOWLEDGE: KnowledgeEntry[] = JSON.parse(readFileSync(join(here, "../knowledge/plants.json"), "utf8"));

export function findKnowledge(name?: string | null, sci?: string | null): KnowledgeEntry | undefined {
  const n = (name ?? "").trim();
  const s = (sci ?? "").trim().toLowerCase();
  return KNOWLEDGE.find(
    (k) => (s !== "" && k.sci.toLowerCase() === s) || (n !== "" && (k.he === n || k.he.includes(n) || n.includes(k.he))),
  );
}
