import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readMemory, getMemoryLineCount } from "../memory/memory-manager.js";
import {
  getAllFacets,
  getFacetCount,
  getFacetsSince,
  getRecentMetrics,
  getLastAnalysisRun,
  insertMetrics,
  saveAnalysisRun,
} from "../db.js";

export interface RunAnalysisInput {
  bootstrap?: boolean;
}

export interface RunAnalysisResult {
  payload: AnalysisPayload;
  prompt: string;
  facets_count: number;
  message: string;
}

export interface AnalysisPayload {
  facets: object[];
  current_memory: string;
  memory_line_count: number;
  previous_metrics: object[];
  is_bootstrap: boolean;
}

export function runAnalysis(input: RunAnalysisInput): RunAnalysisResult {
  const isBootstrap = input.bootstrap ?? false;

  // Determine which facets to process
  const lastRun = getLastAnalysisRun();
  const lastCount = (!isBootstrap && lastRun)
    ? (lastRun.facets_processed || 0)
    : 0;

  // Get facets from SQLite
  const rows = isBootstrap ? getAllFacets() : getFacetsSince(lastCount);

  if (rows.length === 0) {
    return {
      payload: {
        facets: [],
        current_memory: "",
        memory_line_count: 0,
        previous_metrics: [],
        is_bootstrap: isBootstrap,
      },
      prompt: "",
      facets_count: 0,
      message:
        "No new facets to analyze. Use bootstrap=true to reprocess all, or save new facets first.",
    };
  }

  // Parse facets from raw_json
  const facets: object[] = rows.map((r) => {
    try {
      return JSON.parse(r.raw_json);
    } catch {
      return r as any;
    }
  });

  // Get previous metrics from SQLite
  const previousMetrics = getRecentMetrics(12);

  // Read memory
  const currentMemory = readMemory();
  const memoryLineCount = getMemoryLineCount();

  // Assemble payload
  const payload: AnalysisPayload = {
    facets,
    current_memory: currentMemory,
    memory_line_count: memoryLineCount,
    previous_metrics: previousMetrics,
    is_bootstrap: isBootstrap,
  };

  // Load analysis prompt
  const promptsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "prompts"
  );
  let prompt = "";
  const analyzePromptPath = join(promptsDir, "analyze.md");
  if (existsSync(analyzePromptPath)) {
    prompt = readFileSync(analyzePromptPath, "utf-8");
  }

  return {
    payload,
    prompt,
    facets_count: facets.length,
    message: `Assembled ${facets.length} facets for analysis. Process the payload with the provided prompt, then pass the analysis result to save_analysis.`,
  };
}

export interface SaveAnalysisInput {
  analysis_json: string;
}

export interface SaveAnalysisResult {
  success: boolean;
  metrics_appended: boolean;
  facets_processed: number;
  message: string;
}

export function saveAnalysis(input: SaveAnalysisInput): SaveAnalysisResult {
  // Parse analysis
  let analysis: any;
  try {
    let text = input.analysis_json.trim();
    text = text.replace(/^```(?:json)?\s*\n?/, "");
    text = text.replace(/\n?```\s*$/, "");
    analysis = JSON.parse(text);
  } catch (e) {
    return {
      success: false,
      metrics_appended: false,
      facets_processed: 0,
      message: `Invalid analysis JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Append metrics to SQLite
  let metricsAppended = false;
  if (analysis.metrics) {
    insertMetrics(analysis.metrics);
    metricsAppended = true;
  }

  // Save analysis run
  const totalFacets = getFacetCount();
  const runData = {
    timestamp: new Date().toISOString(),
    facets_processed: totalFacets,
    sessions_analyzed: analysis.sessions_analyzed || 0,
    friction_rate: analysis.friction_summary?.friction_rate || 0,
    trend: analysis.trend || "unknown",
    updates_applied: analysis.memory_updates?.length || 0,
    analysis,
  };
  saveAnalysisRun(runData);

  return {
    success: true,
    metrics_appended: metricsAppended,
    facets_processed: totalFacets,
    message: `Analysis saved to SQLite. ${analysis.memory_updates?.length || 0} memory updates proposed. Use update_memory to apply them.`,
  };
}
