import Database from "better-sqlite3";
import { existsSync, readdirSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getConfig } from "./config.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const config = getConfig();
  if (!existsSync(config.data_dir)) {
    mkdirSync(config.data_dir, { recursive: true });
  }

  const dbPath = join(config.data_dir, "facets.db");
  db = new Database(dbPath);

  // WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");

  initSchema(db);

  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS facets (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      timestamp TEXT,
      source TEXT DEFAULT 'mcp-inline',
      facet_model TEXT,

      -- Core fields
      underlying_goal TEXT,
      outcome TEXT,
      claude_helpfulness TEXT,
      session_type TEXT,
      primary_success TEXT,
      session_complexity TEXT,
      recovery_quality TEXT,
      root_cause_depth TEXT,
      context_switches INTEGER DEFAULT 0,

      -- Text fields (searchable via FTS)
      brief_summary TEXT,
      friction_detail TEXT,

      -- JSON fields (stored as text)
      goal_categories TEXT,
      friction_counts TEXT,
      user_satisfaction_counts TEXT,

      -- Full facet JSON for backward compatibility
      raw_json TEXT,

      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      sessions_analyzed INTEGER,
      friction_rate REAL,
      effective_friction_rate REAL,
      complexity_weighted_friction_rate REAL,
      avg_satisfaction REAL,
      top_friction TEXT,
      top_success TEXT,
      outcome_success_rate REAL,
      raw_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analysis_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      facets_processed INTEGER,
      sessions_analyzed INTEGER,
      friction_rate REAL,
      trend TEXT,
      updates_applied INTEGER,
      raw_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // FTS5 virtual table for full-text search over facets
  // Use IF NOT EXISTS pattern: try to create, ignore if exists
  try {
    db.exec(`
      CREATE VIRTUAL TABLE facets_fts USING fts5(
        session_id,
        underlying_goal,
        brief_summary,
        friction_detail,
        outcome,
        session_type,
        content='facets',
        content_rowid='rowid'
      );
    `);
  } catch {
    // Table already exists — that's fine
  }

  // Triggers to keep FTS in sync
  try {
    db.exec(`
      CREATE TRIGGER facets_ai AFTER INSERT ON facets BEGIN
        INSERT INTO facets_fts(rowid, session_id, underlying_goal, brief_summary, friction_detail, outcome, session_type)
        VALUES (new.rowid, new.session_id, new.underlying_goal, new.brief_summary, new.friction_detail, new.outcome, new.session_type);
      END;
    `);
  } catch {
    // Trigger already exists
  }

  try {
    db.exec(`
      CREATE TRIGGER facets_ad AFTER DELETE ON facets BEGIN
        INSERT INTO facets_fts(facets_fts, rowid, session_id, underlying_goal, brief_summary, friction_detail, outcome, session_type)
        VALUES ('delete', old.rowid, old.session_id, old.underlying_goal, old.brief_summary, old.friction_detail, old.outcome, old.session_type);
      END;
    `);
  } catch {
    // Trigger already exists
  }
}

// ── Facet Operations ─────────────────────────────────────────────────────────

export interface FacetRow {
  id: string;
  session_id: string;
  timestamp: string;
  source: string;
  facet_model: string | null;
  underlying_goal: string;
  outcome: string;
  claude_helpfulness: string;
  session_type: string;
  primary_success: string;
  session_complexity: string;
  recovery_quality: string;
  root_cause_depth: string;
  context_switches: number;
  brief_summary: string;
  friction_detail: string;
  goal_categories: string;
  friction_counts: string;
  user_satisfaction_counts: string;
  raw_json: string;
}

export function insertFacet(facet: Record<string, any>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO facets (
      id, session_id, timestamp, source, facet_model,
      underlying_goal, outcome, claude_helpfulness, session_type,
      primary_success, session_complexity, recovery_quality,
      root_cause_depth, context_switches,
      brief_summary, friction_detail,
      goal_categories, friction_counts, user_satisfaction_counts,
      raw_json
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?
    )
  `);

  stmt.run(
    facet.session_id || facet.id,
    facet.session_id || facet.id,
    facet.timestamp || new Date().toISOString(),
    facet.source || "mcp-inline",
    facet.facet_model || null,
    facet.underlying_goal || "",
    facet.outcome || "unclear_from_transcript",
    facet.claude_helpfulness || "helpful",
    facet.session_type || "exploration",
    facet.primary_success || "efficient_workflow",
    facet.session_complexity || "medium",
    facet.recovery_quality || "not_applicable",
    facet.root_cause_depth || "not_applicable",
    facet.context_switches || 0,
    facet.brief_summary || "",
    facet.friction_detail || "",
    JSON.stringify(facet.goal_categories || {}),
    JSON.stringify(facet.friction_counts || {}),
    JSON.stringify(facet.user_satisfaction_counts || {}),
    JSON.stringify(facet)
  );
}

export function searchFacets(query: string, limit: number = 20): FacetRow[] {
  const db = getDb();

  // FTS5 search with BM25 ranking
  const stmt = db.prepare(`
    SELECT f.*, rank
    FROM facets f
    JOIN facets_fts fts ON f.rowid = fts.rowid
    WHERE facets_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  return stmt.all(query, limit) as FacetRow[];
}

export function getAllFacets(
  options: { since?: string; limit?: number; offset?: number } = {}
): FacetRow[] {
  const db = getDb();
  let sql = "SELECT * FROM facets";
  const params: any[] = [];

  if (options.since) {
    sql += " WHERE timestamp > ?";
    params.push(options.since);
  }

  sql += " ORDER BY timestamp ASC";

  if (options.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  if (options.offset) {
    sql += " OFFSET ?";
    params.push(options.offset);
  }

  return db.prepare(sql).all(...params) as FacetRow[];
}

export function getFacetCount(): number {
  const db = getDb();
  return (db.prepare("SELECT COUNT(*) as count FROM facets").get() as any).count;
}

export function getRecentFacets(limit: number = 50): FacetRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM facets ORDER BY timestamp DESC LIMIT ?")
    .all(limit) as FacetRow[];
}

export function getFacetsSince(lastCount: number): FacetRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM facets ORDER BY timestamp ASC LIMIT -1 OFFSET ?")
    .all(lastCount) as FacetRow[];
}

// ── Metrics Operations ───────────────────────────────────────────────────────

export function insertMetrics(metrics: Record<string, any>): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO metrics (
      timestamp, sessions_analyzed, friction_rate,
      effective_friction_rate, complexity_weighted_friction_rate,
      avg_satisfaction, top_friction, top_success,
      outcome_success_rate, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    metrics.timestamp || new Date().toISOString(),
    metrics.sessions_analyzed || 0,
    metrics.friction_rate || 0,
    metrics.effective_friction_rate || 0,
    metrics.complexity_weighted_friction_rate || 0,
    metrics.avg_satisfaction || 0,
    metrics.top_friction || "",
    metrics.top_success || "",
    metrics.outcome_success_rate || 0,
    JSON.stringify(metrics)
  );
}

export function getRecentMetrics(limit: number = 12): Record<string, any>[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT raw_json FROM metrics ORDER BY id DESC LIMIT ?")
    .all(limit) as { raw_json: string }[];

  return rows.reverse().map((r) => JSON.parse(r.raw_json));
}

// ── Analysis Run Operations ──────────────────────────────────────────────────

export function saveAnalysisRun(run: Record<string, any>): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO analysis_runs (
      timestamp, facets_processed, sessions_analyzed,
      friction_rate, trend, updates_applied, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    run.timestamp || new Date().toISOString(),
    run.facets_processed || 0,
    run.sessions_analyzed || 0,
    run.friction_rate || 0,
    run.trend || "unknown",
    run.updates_applied || 0,
    JSON.stringify(run)
  );
}

export function getLastAnalysisRun(): Record<string, any> | null {
  const db = getDb();
  const row = db
    .prepare("SELECT raw_json FROM analysis_runs ORDER BY id DESC LIMIT 1")
    .get() as { raw_json: string } | undefined;

  return row ? JSON.parse(row.raw_json) : null;
}

// ── Migration ────────────────────────────────────────────────────────────────

export function migrateJsonFacets(facetsDir: string): number {
  if (!existsSync(facetsDir)) return 0;

  const db = getDb();
  const existing = getFacetCount();
  if (existing > 0) return 0; // Already migrated

  const files = readdirSync(facetsDir).filter((f) => f.endsWith(".json"));
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO facets (
      id, session_id, timestamp, source, facet_model,
      underlying_goal, outcome, claude_helpfulness, session_type,
      primary_success, session_complexity, recovery_quality,
      root_cause_depth, context_switches,
      brief_summary, friction_detail,
      goal_categories, friction_counts, user_satisfaction_counts,
      raw_json
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?
    )
  `);

  const insertMany = db.transaction((facets: Record<string, any>[]) => {
    for (const facet of facets) {
      insertStmt.run(
        facet.session_id || facet.id || "",
        facet.session_id || facet.id || "",
        facet.timestamp || "",
        facet.source || "migrated",
        facet.facet_model || null,
        facet.underlying_goal || "",
        facet.outcome || "unclear_from_transcript",
        facet.claude_helpfulness || "helpful",
        facet.session_type || "exploration",
        facet.primary_success || "efficient_workflow",
        facet.session_complexity || "medium",
        facet.recovery_quality || "not_applicable",
        facet.root_cause_depth || "not_applicable",
        facet.context_switches || 0,
        facet.brief_summary || "",
        facet.friction_detail || "",
        JSON.stringify(facet.goal_categories || {}),
        JSON.stringify(facet.friction_counts || {}),
        JSON.stringify(facet.user_satisfaction_counts || {}),
        JSON.stringify(facet)
      );
    }
  });

  const facets: Record<string, any>[] = [];
  for (const f of files) {
    try {
      facets.push(JSON.parse(readFileSync(join(facetsDir, f), "utf-8")));
    } catch {}
  }

  insertMany(facets);
  return facets.length;
}

export function migrateJsonlMetrics(metricsFile: string): number {
  if (!existsSync(metricsFile)) return 0;

  const db = getDb();
  const existing = (
    db.prepare("SELECT COUNT(*) as count FROM metrics").get() as any
  ).count;
  if (existing > 0) return 0; // Already migrated

  const lines = readFileSync(metricsFile, "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  const insertStmt = db.prepare(`
    INSERT INTO metrics (
      timestamp, sessions_analyzed, friction_rate,
      effective_friction_rate, complexity_weighted_friction_rate,
      avg_satisfaction, top_friction, top_success,
      outcome_success_rate, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((entries: Record<string, any>[]) => {
    for (const m of entries) {
      insertStmt.run(
        m.timestamp || "",
        m.sessions_analyzed || 0,
        m.friction_rate || 0,
        m.effective_friction_rate || 0,
        m.complexity_weighted_friction_rate || 0,
        m.avg_satisfaction || 0,
        m.top_friction || "",
        m.top_success || "",
        m.outcome_success_rate || 0,
        JSON.stringify(m)
      );
    }
  });

  const entries: Record<string, any>[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {}
  }

  insertMany(entries);
  return entries.length;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
