import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { saveFacet } from "./tools/save-facet.js";
import { readMemoryTool } from "./tools/read-memory.js";
import { updateMemory } from "./tools/update-memory.js";
import { runAnalysis, saveAnalysis } from "./tools/run-analysis.js";
import { recall } from "./tools/recall.js";
import { getMetrics } from "./tools/get-metrics.js";
import { initDataDir, getConfig } from "./config.js";
import { readMemory, listTopicFiles, readTopicFile } from "./memory/memory-manager.js";
import { migrateJsonFacets, migrateJsonlMetrics, getFacetCount } from "./db.js";
import { join } from "path";

export function createServer(): McpServer {
  // Ensure data directory exists
  initDataDir();

  // Auto-migrate JSON facets and JSONL metrics to SQLite on first run
  const config = getConfig();
  const facetsDir = join(config.data_dir, "facets");
  const metricsFile = join(config.data_dir, "metrics.jsonl");
  const facetsMigrated = migrateJsonFacets(facetsDir);
  const metricsMigrated = migrateJsonlMetrics(metricsFile);
  if (facetsMigrated > 0 || metricsMigrated > 0) {
    console.error(`[claude-improve] Migrated ${facetsMigrated} facets + ${metricsMigrated} metrics to SQLite`);
  }

  const server = new McpServer({
    name: "claude-improve",
    version: "0.1.0",
  });

  // ── Tools ──────────────────────────────────────────────────────────────────

  server.tool(
    "save_facet",
    "Save a session performance facet. Generate a facet JSON following the schema (28 fields including friction_counts, outcome, session_type, etc.) and pass it here for validation and storage. Call this at the end of a conversation to capture performance data for self-improvement analysis.",
    {
      facet_json: z
        .string()
        .describe(
          "JSON string of the facet object. May include markdown fences."
        ),
      session_id: z
        .string()
        .optional()
        .describe(
          "Optional session identifier. Auto-generated if not provided."
        ),
      source: z
        .string()
        .optional()
        .describe("Source identifier (default: mcp-inline)"),
    },
    async (params) => {
      const result = saveFacet(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "read_memory",
    "Read the current MEMORY.md contents and list topic files. Use this to understand what Claude already knows before suggesting updates.",
    {
      include_topic_files: z
        .boolean()
        .optional()
        .describe("Include all topic file contents"),
      topic_file: z
        .string()
        .optional()
        .describe("Read a specific topic file by name"),
    },
    async (params) => {
      const result = readMemoryTool(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "update_memory",
    "Apply memory operations (append_to_section, create_topic_file, archive_to_topic, update_active_threads). Creates a backup before any changes. MEMORY.md must stay under 200 lines.",
    {
      operations: z
        .array(
          z.object({
            operation: z.enum([
              "append_to_section",
              "create_topic_file",
              "archive_to_topic",
              "update_active_threads",
            ]),
            section: z
              .string()
              .optional()
              .describe("Section name for append/archive operations"),
            filename: z
              .string()
              .optional()
              .describe("Filename for create_topic_file/archive operations"),
            content: z.string().describe("Content to write"),
            reason: z
              .string()
              .optional()
              .describe("Why this update is needed"),
          })
        )
        .describe("Array of memory operations to apply"),
    },
    async (params) => {
      const result = updateMemory(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "run_analysis",
    "Assemble unprocessed facets into an analysis payload with the analysis prompt. Returns the payload and prompt text for you to process inline — analyze friction patterns, satisfaction trends, and propose memory updates. After analysis, pass the result to save_analysis.",
    {
      bootstrap: z
        .boolean()
        .optional()
        .describe("Process ALL facets instead of only new ones"),
    },
    async (params) => {
      const result = runAnalysis(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "save_analysis",
    "Save the analysis result JSON after processing the run_analysis payload. Writes analysis.json, appends metrics, and updates last-run state.",
    {
      analysis_json: z
        .string()
        .describe(
          "The analysis result JSON string produced by processing the run_analysis payload"
        ),
    },
    async (params) => {
      const result = saveAnalysis(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "recall",
    "Search past session history by semantic query. Returns a session index and recall prompt for you to process inline. Use for finding relevant past sessions, understanding patterns, or answering 'when did we last...' questions.",
    {
      query: z.string().describe("Natural language search query"),
      deep: z
        .boolean()
        .optional()
        .describe(
          "Enable deep recall with multi-hop reasoning and causal chains"
        ),
    },
    async (params) => {
      const result = recall(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_metrics",
    "Return metrics history and trend summary. Shows friction rates, satisfaction scores, and performance trends over time.",
    {
      last_n: z
        .number()
        .optional()
        .describe("Number of recent metric entries to return (default: 12)"),
    },
    async (params) => {
      const result = getMetrics(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ── Resources ──────────────────────────────────────────────────────────────

  server.resource(
    "memory",
    "memory://current",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: readMemory(),
        },
      ],
    })
  );

  server.resource(
    "topic-files",
    "memory://topics",
    async (uri) => {
      const files = listTopicFiles();
      const parts = files.map((f) => `## ${f}\n${readTopicFile(f)}`);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: parts.join("\n\n---\n\n") || "No topic files found.",
          },
        ],
      };
    }
  );

  return server;
}
