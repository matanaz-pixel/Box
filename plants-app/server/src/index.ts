import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { openDb } from "./db/index.ts";
import { startJobs } from "./jobs.ts";

const cfg = loadConfig();
const db = await openDb(cfg);
const app = await buildApp(cfg, db);
startJobs(db, cfg);
await app.listen({ port: cfg.port, host: "0.0.0.0" });
console.log(`שרת עלה על :${cfg.port} | מודל: ${cfg.anthropicKey ? cfg.modelId : "מדומה (אין ANTHROPIC_API_KEY)"} | מסד: ${db.kind}`);
