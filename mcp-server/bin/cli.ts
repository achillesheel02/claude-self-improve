#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, copyFileSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { initDataDir, writeConfig, getConfig } from "../src/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const command = args[0];

function usage() {
  console.log(`claude-improve-mcp — Self-improvement MCP server for Claude

Commands:
  init                  Create ~/.claude-improve/ directory structure and default config
  migrate               Import existing data from Claude Code's self-improve system
  config                Show current configuration
  config set KEY VALUE  Set a configuration value
  status                Show facet count, memory stats, and last run info

Options:
  --help, -h            Show this help message
`);
}

async function init() {
  console.log("Initializing claude-improve data directory...");
  initDataDir();
  const config = getConfig();
  console.log(`  Data directory: ${config.data_dir}`);
  console.log(`  Memory directory: ${config.memory_dir}`);
  console.log(`  Config: ${join(config.data_dir, "config.json")}`);
  console.log("");
  console.log("Add to your Claude Desktop config:");
  console.log("");
  console.log(JSON.stringify({
    mcpServers: {
      "claude-improve": {
        command: "node",
        args: [resolve(join(__dirname, "..", "src", "index.js"))],
      },
    },
  }, null, 2));
  console.log("");
  console.log("Done! Restart Claude Desktop to activate.");
}

async function migrate() {
  initDataDir();
  const config = getConfig();
  const facetsDir = join(config.data_dir, "facets");
  const claudeFacetsDir = join(homedir(), ".claude", "usage-data", "facets");
  const claudeMetrics = join(homedir(), ".local", "share", "claude-improve", "metrics.jsonl");

  console.log("Migrating from Claude Code self-improve system...");
  console.log("");

  // 1. Copy facets
  if (existsSync(claudeFacetsDir)) {
    const facetFiles = readdirSync(claudeFacetsDir).filter((f) => f.endsWith(".json"));
    let copied = 0;
    for (const f of facetFiles) {
      const src = join(claudeFacetsDir, f);
      const dst = join(facetsDir, f);
      if (!existsSync(dst)) {
        copyFileSync(src, dst);
        copied++;
      }
    }
    console.log(`  Facets: ${copied} copied, ${facetFiles.length - copied} already exist`);
  } else {
    console.log(`  Facets: skipped (${claudeFacetsDir} not found)`);
  }

  // 2. Import metrics
  if (existsSync(claudeMetrics)) {
    const dst = join(config.data_dir, "metrics.jsonl");
    if (!existsSync(dst)) {
      copyFileSync(claudeMetrics, dst);
      const lineCount = readFileSync(dst, "utf-8").split("\n").filter(l => l.trim()).length;
      console.log(`  Metrics: ${lineCount} entries imported`);
    } else {
      console.log("  Metrics: already exist, skipping");
    }
  } else {
    console.log(`  Metrics: skipped (${claudeMetrics} not found)`);
  }

  // 3. Auto-detect Claude Code memory directory
  const claudeProjectsDir = join(homedir(), ".claude", "projects");
  if (existsSync(claudeProjectsDir)) {
    // Find most recently modified MEMORY.md
    let newestMemory = "";
    let newestMtime = 0;
    const projectDirs = readdirSync(claudeProjectsDir);
    for (const d of projectDirs) {
      const memDir = join(claudeProjectsDir, d, "memory");
      const memFile = join(memDir, "MEMORY.md");
      if (existsSync(memFile)) {
        const mtime = statSync(memFile).mtimeMs;
        if (mtime > newestMtime) {
          newestMtime = mtime;
          newestMemory = memDir;
        }
      }
    }

    if (newestMemory) {
      console.log(`  Claude Code memory found: ${newestMemory}`);
      console.log("");
      console.log("  Options:");
      console.log(`  1. Symlink (shared memory): claude-improve-mcp config set memory_dir "${newestMemory}"`);
      console.log(`  2. Copy (independent): cp "${join(newestMemory, "MEMORY.md")}" "${config.memory_dir}/"`);
    }
  }

  console.log("");
  console.log("Migration complete!");
}

async function showConfig() {
  const config = getConfig();
  if (args[1] === "set" && args[2] && args[3]) {
    const key = args[2];
    const value = args[3] === "true" ? true : args[3] === "false" ? false : args[3];
    writeConfig({ [key]: value } as any);
    console.log(`Set ${key} = ${value}`);
  } else {
    console.log(JSON.stringify(config, null, 2));
  }
}

async function showStatus() {
  const config = getConfig();
  const facetsDir = join(config.data_dir, "facets");
  const metricsFile = join(config.data_dir, "metrics.jsonl");
  const lastRunFile = join(config.data_dir, "last-run.json");
  const memoryFile = join(config.memory_dir, "MEMORY.md");

  console.log("claude-improve-mcp status");
  console.log("─────────────────────────");

  // Facets
  if (existsSync(facetsDir)) {
    const count = readdirSync(facetsDir).filter(f => f.endsWith(".json")).length;
    console.log(`  Facets: ${count}`);
  } else {
    console.log("  Facets: 0 (directory not found)");
  }

  // Memory
  if (existsSync(memoryFile)) {
    const lines = readFileSync(memoryFile, "utf-8").split("\n").length;
    console.log(`  MEMORY.md: ${lines} lines`);
  } else {
    console.log("  MEMORY.md: not found");
  }

  // Topic files
  const topicFiles = existsSync(config.memory_dir)
    ? readdirSync(config.memory_dir).filter(f => f.endsWith(".md") && f !== "MEMORY.md")
    : [];
  console.log(`  Topic files: ${topicFiles.length}`);

  // Metrics
  if (existsSync(metricsFile)) {
    const count = readFileSync(metricsFile, "utf-8").split("\n").filter(l => l.trim()).length;
    console.log(`  Metrics entries: ${count}`);
  } else {
    console.log("  Metrics: none");
  }

  // Last run
  if (existsSync(lastRunFile)) {
    try {
      const lastRun = JSON.parse(readFileSync(lastRunFile, "utf-8"));
      console.log(`  Last run: ${lastRun.timestamp}`);
      console.log(`    Sessions: ${lastRun.sessions_analyzed}, Friction: ${lastRun.friction_rate}, Trend: ${lastRun.trend}`);
    } catch {}
  } else {
    console.log("  Last run: never");
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

switch (command) {
  case "init":
    init();
    break;
  case "migrate":
    migrate();
    break;
  case "config":
    showConfig();
    break;
  case "status":
    showStatus();
    break;
  case "--help":
  case "-h":
  case undefined:
    usage();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
}
