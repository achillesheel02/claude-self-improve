import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { searchFacets, getRecentFacets, type FacetRow } from "../db.js";

export interface RecallInput {
  query: string;
  deep?: boolean;
}

export interface SessionMatch {
  session_id: string;
  date: string;
  summary: string;
  goal: string;
  friction_types: string[];
  outcome: string;
  session_type: string;
  relevance_score?: number;
}

export interface RecallResult {
  query: string;
  matches: SessionMatch[];
  total_sessions: number;
  prompt: string;
  message: string;
}

export function recall(input: RecallInput): RecallResult {
  const limit = input.deep ? 30 : 15;

  // Try FTS5 search first
  let rows: FacetRow[];
  try {
    rows = searchFacets(input.query, limit);
  } catch {
    // FTS query syntax error — fall back to recent facets
    rows = getRecentFacets(limit);
  }

  const matches: SessionMatch[] = rows.map((r) => ({
    session_id: r.session_id,
    date: r.timestamp ? r.timestamp.slice(0, 10) : "",
    summary: r.brief_summary || "",
    goal: r.underlying_goal || "",
    friction_types: Object.keys(safeJsonParse(r.friction_counts)),
    outcome: r.outcome || "unknown",
    session_type: r.session_type || "unknown",
  }));

  // Load recall prompt
  const promptsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "prompts"
  );
  let prompt = "";
  const recallPromptPath = join(promptsDir, "recall.md");
  if (existsSync(recallPromptPath)) {
    prompt = readFileSync(recallPromptPath, "utf-8");
  }

  return {
    query: input.query,
    matches,
    total_sessions: matches.length,
    prompt,
    message: matches.length > 0
      ? `Found ${matches.length} matching sessions via FTS5 search for "${input.query}". Review the matches and rank by relevance.`
      : `No FTS5 matches for "${input.query}". Showing ${matches.length} recent sessions instead.`,
  };
}

function safeJsonParse(text: string | null): Record<string, any> {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
