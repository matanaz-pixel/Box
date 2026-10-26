import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import type { Config } from "../config.ts";
import { MIGRATIONS } from "./migrations.ts";

export type Row = Record<string, any>;
export interface Db {
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<void>;
  close(): Promise<void>;
  kind: "sqlite" | "pg";
}

function sqliteDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  const norm = (p: unknown[] = []) => p.map((v) => (v === undefined ? null : v)) as any[];
  return {
    kind: "sqlite",
    async all(sql, p) { return db.prepare(sql).all(...norm(p)) as any; },
    async get(sql, p) { return db.prepare(sql).get(...norm(p)) as any; },
    async run(sql, p) { db.prepare(sql).run(...norm(p)); },
    async close() { db.close(); },
  };
}

function pgDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 5, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  // הקוד כותב placeholders בסגנון ? ומומר ל-$n
  const conv = (sql: string) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };
  const norm = (p: unknown[] = []) => p.map((v) => (v === undefined ? null : v));
  return {
    kind: "pg",
    async all(sql, p) { return (await pool.query(conv(sql), norm(p))).rows as any; },
    async get(sql, p) { return (await pool.query(conv(sql), norm(p))).rows[0] as any; },
    async run(sql, p) { await pool.query(conv(sql), norm(p)); },
    async close() { await pool.end(); },
  };
}

export async function openDb(cfg: Pick<Config, "databaseUrl" | "sqlitePath">): Promise<Db> {
  const db = cfg.databaseUrl ? pgDb(cfg.databaseUrl) : sqliteDb(cfg.sqlitePath);
  for (const m of MIGRATIONS) await db.run(m);
  return db;
}
