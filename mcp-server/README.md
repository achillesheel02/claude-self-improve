# claude-improve-mcp

MCP server for Claude self-improvement — facet capture, analysis, memory management, and session recall.

Port of the [`claude-self-improve`](../README.md) bash pipeline to an MCP server that works with **Claude.ai Desktop App**, with full backward compatibility. Both systems share the same SQLite database.

## How It Works

Instead of batch post-hoc transcript analysis, this uses **inline reflection** — Claude generates performance facets during the conversation while it has full context.

```
You (in Claude.ai Desktop): "reflect on this session"
  → Claude generates facet JSON (full conversation context)
  → Claude calls save_facet tool → validated + stored in SQLite
  → Periodically: run_analysis → processes facets → proposes memory updates
  → update_memory → persistent lessons updated
```

## Quick Start

### 1. Install

```bash
cd mcp-server
npm install
```

Or from npm:

```bash
npm install -g @bachillah/claude-improve-mcp
```

### 2. Initialize

```bash
npx claude-improve-mcp init
```

### 3. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "claude-improve": {
      "command": "node",
      "args": ["/path/to/claude-self-improve/mcp-server/dist/src/index.js"]
    }
  }
}
```

Restart Claude Desktop. You should see 7 tools in the MCP tools list.

### 4. Migrate Existing Data (Optional)

If you already use `claude-self-improve` (the bash script):

```bash
npx claude-improve-mcp migrate
```

Imports existing facets and metrics into the shared SQLite database.

### 5. Share Memory with Claude Code (Optional)

```bash
npx claude-improve-mcp config set memory_dir "/path/to/.claude/projects/YOUR_PROJECT/memory"
```

## Tools

| Tool | Description |
|------|-------------|
| `save_facet` | Save a session performance facet (validates 28-field schema with coercion) |
| `read_memory` | Read MEMORY.md and list/read topic files |
| `update_memory` | Apply memory operations (append, create topic file, archive) |
| `run_analysis` | Assemble unprocessed facets into analysis payload |
| `save_analysis` | Save analysis results and append metrics |
| `recall` | FTS5 search past sessions by query |
| `get_metrics` | Return metrics history and trend summary |

## Storage

Data stored in SQLite at `~/.claude-improve/facets.db`:
- **facets** table — 20 columns, FTS5 indexed for fast search
- **metrics** table — time-series performance data
- **analysis_runs** table — analysis history

Both the bash script and MCP server read/write the same database.

## Schema Compatibility

The facet schema (28 fields), validation logic, coercion maps, all 6 prompt files, MEMORY.md format, and metrics format are 100% identical to the bash system. Facets created by either system are interchangeable.

## License

MIT
