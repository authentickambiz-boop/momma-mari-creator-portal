import { DatabaseSync, type StatementSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { D1Database } from "@cloudflare/workers-types";

type SqlValue = string | number | null | bigint | Uint8Array;

function normalize(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" || typeof value === "string") return value;
  if (value instanceof Uint8Array) return value;
  return String(value);
}

class BoundStatement {
  constructor(
    private readonly sqlite: DatabaseSync,
    private readonly sql: string,
    private readonly params: SqlValue[],
  ) {}

  bind(...params: unknown[]) {
    return new BoundStatement(this.sqlite, this.sql, params.map(normalize));
  }

  private statement(): StatementSync {
    return this.sqlite.prepare(this.sql);
  }

  async all<T = Record<string, unknown>>() {
    const statement = this.statement();
    const results = statement.all(...this.params) as T[];
    return { success: true, results, meta: this.meta(results.length) };
  }

  async raw<T = unknown[]>() {
    const rows = this.statement().all(...this.params) as Record<string, unknown>[];
    return rows.map((row) => Object.keys(row).map((key) => row[key])) as T[];
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const { results } = await this.all<Record<string, unknown>>();
    const row = results[0];
    if (!row) return null;
    if (column) return (row[column] as T) ?? null;
    return row as T;
  }

  async run() {
    const info = this.statement().run(...this.params);
    const changes = Number(info.changes ?? 0);
    return {
      success: true,
      meta: {
        ...this.meta(changes),
        changes,
        last_row_id: Number(info.lastInsertRowid ?? 0),
      },
    };
  }

  private meta(changes: number) {
    return {
      duration: 0,
      changes,
      last_row_id: 0,
      rows_read: changes,
      rows_written: changes,
      served_by: "local",
    };
  }
}

class NodeSqliteD1 {
  constructor(private readonly sqlite: DatabaseSync) {}

  prepare(sql: string) {
    return new BoundStatement(this.sqlite, sql, []);
  }

  async batch<T = unknown>(statements: BoundStatement[]): Promise<T[]> {
    const results: T[] = [];
    for (const statement of statements) {
      results.push((await statement.all()) as T);
    }
    return results;
  }

  async exec(sql: string) {
    this.sqlite.exec(sql);
    return { count: 0, duration: 0 };
  }
}

function migrationsDir() {
  return path.join(process.cwd(), "drizzle");
}

export function applyMigrations(sqlite: DatabaseSync) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  );`);
  const files = readdirSync(migrationsDir())
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const applied = new Set(
    (sqlite.prepare("SELECT name FROM d1_migrations").all() as { name: string }[]).map((row) => row.name),
  );
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(migrationsDir(), file), "utf8");
    sqlite.exec("BEGIN");
    try {
      sqlite.exec(sql);
      sqlite.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(file);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

export function openDatabase(filename: string): D1Database {
  const sqlite = new DatabaseSync(filename);
  applyMigrations(sqlite);
  return new NodeSqliteD1(sqlite) as unknown as D1Database;
}

const openFiles = new Map<string, D1Database>();

export function openLocalFile(): D1Database {
  const filename = process.env.PORTAL_SQLITE_PATH || path.join(process.cwd(), "data", "portal.sqlite");
  const existing = openFiles.get(filename);
  if (existing) return existing;
  mkdirSync(path.dirname(filename), { recursive: true });
  const database = openDatabase(filename);
  openFiles.set(filename, database);
  return database;
}

export function localSqlitePath() {
  return process.env.PORTAL_SQLITE_PATH || path.join(process.cwd(), "data", "portal.sqlite");
}
