# claude-self-improve

A self-improvement system for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Analyzes your session performance data to automatically extract patterns, identify friction points, and update Claude's persistent memory — so it gets better at helping you over time.

![demo](demo.gif)

## How It Works

Claude Code stores session performance data as "facets" — JSON files capturing outcomes, friction events, and satisfaction signals. This system:

0. **Generates** missing facets from session transcripts (via Haiku — auto-detects stale data)
1. **Collects** new session facets since the last run
2. **Analyzes** them with headless Claude (Sonnet) to extract patterns, track effectiveness, and detect trends
3. **Updates** your MEMORY.md with new lessons, anti-patterns, and preferences
4. **Meta-analyzes** itself periodically — detecting zombie patterns, stale entries, and scoring system health

```
┌─────────────────────────┐
│   Claude Code Sessions  │
│   (your daily usage)    │
└───────────┬─────────────┘
            │ session transcripts
            ▼
┌─────────────────────────┐
│  Stage 0: Refresh       │
│  Auto-generate facets   │
│  for sessions missing   │
│  them (Haiku, ~$0.01/   │
│  session). Skips if     │
│  /insights ran recently │
└───────────┬─────────────┘
            │ facets (JSON)
            ▼
┌─────────────────────────┐
│  Stage 1: Collect       │
│  Gather new session     │
│  facets since last run  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Stage 2: Analyze       │
│  Headless Claude        │
│  (Sonnet) extracts      │
│  friction patterns,     │
│  success patterns,      │
│  and new lessons        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Stage 3: Update        │
│  Headless Claude        │
│  applies changes to     │
│  MEMORY.md + topic      │
│  files                  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Stage 4: Meta          │
│  (every 5th run)        │
│  Zombie detection,      │
│  effectiveness scoring, │
│  stale entry cleanup    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Claude Code loads      │
│  updated MEMORY.md      │
│  in next session        │
└─────────────────────────┘
```

## What It Tracks

| Category | Examples |
|----------|---------|
| **Friction patterns** | Wrong initial diagnosis, CSS over-engineering, premature commits |
| **Success patterns** | Good debugging, efficient multi-file changes, proactive documentation |
| **Anti-patterns** | Recurring mistakes Claude should avoid |
| **Working preferences** | How you like to work (diagnostic queries first, one CSS change at a time) |
| **Domain lessons** | Technical insights specific to your stack |
| **Trend analysis** | Is friction improving, worsening, or stable over time? |
| **Effectiveness tracking** | Are memory updates actually reducing friction? Correlates updates with outcomes |
| **Recovery quality** | How well does Claude self-correct after friction? Distinguishes raw vs effective friction |
| **Session complexity** | Weights friction by task difficulty — wrong approach on a hard task is less concerning |
| **Zombie detection** | Finds anti-patterns documented in memory that still recur (meta-analysis) |

## Installation

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and used for at least a few sessions
- `python3` and `jq` installed
- At least one MEMORY.md file in your Claude Code project memory

### Install

```bash
git clone https://github.com/achillesheel02/claude-self-improve.git
cd claude-self-improve
./install.sh
```

This installs:
- `~/.local/bin/claude-self-improve` — main script
- `~/.local/share/claude-improve/prompts/` — analysis and update prompts
- `~/.claude/commands/self-improve.md` — `/self-improve` slash command for Claude Code
- `~/.claude/commands/recall.md` — `/recall` slash command for session search

### Uninstall

```bash
./install.sh --uninstall
```

## Usage

### First Run (Bootstrap)

Process all existing session data:

```bash
claude-self-improve --bootstrap
```

### Incremental (Daily/Weekly)

Process only new sessions since last run:

```bash
claude-self-improve
```

### Interactive Mode

Review proposed changes before they're applied:

```bash
claude-self-improve --interactive
```

### Dry Run

Analyze without modifying any files:

```bash
claude-self-improve --dry-run
```

### Skip Facet Generation

Use only existing facets (skip Stage 0):

```bash
claude-self-improve --no-refresh
```

Force facet generation even if facets are fresh:

```bash
claude-self-improve --refresh-facets
```

### Deep Recall

Search past sessions with multi-hop reasoning (uses Sonnet for causal chains and temporal reasoning):

```bash
claude-self-improve --deep-recall "what caused the deployment failure last week"
```

Standard recall uses Haiku (faster, cheaper). Deep recall uses Sonnet and returns up to 10 matches with connection chain reasoning.

### Meta-Analysis

Evaluate whether the system itself is working — are memory updates actually reducing friction?

```bash
claude-self-improve --meta
```

This runs automatically every 5th incremental run. It detects:
- **Zombie patterns**: Anti-patterns documented in memory that still recur
- **Stale entries**: Memory entries ready for archival (closed tickets, deprecated systems)
- **Effectiveness correlation**: Which memory updates actually reduced their targeted friction type
- **System health score**: 0-100 composite (friction trend, memory freshness, zombie count, update effectiveness)

### Prompt Optimization

Audit the quality of the system's own prompts against actual outputs:

```bash
claude-self-improve --optimize-prompts
```

### Clean Facets

Re-validate all existing facets against the schema (no API calls, fixes schema violations locally):

```bash
claude-self-improve --clean-facets
```

### Slash Commands

The installer adds two slash commands to Claude Code (`~/.claude/commands/`):

#### `/self-improve`

Run the full self-improvement pipeline interactively from within Claude Code:

```
/self-improve
```

This triggers `claude-self-improve --interactive`, showing sessions analyzed, friction rate, trends, and memory updates. After completion it offers follow-up actions like viewing friction trends or reviewing CLAUDE.md suggestions.

> **Note:** Running `/self-improve` from within Claude Code may fail due to nested session detection (it spawns a headless Claude instance). If this happens, run it in a separate terminal instead:
> ```bash
> claude-self-improve --interactive
> ```

#### `/recall`

Search past Claude Code sessions for conversations matching a query:

```
/recall kubernetes deployment issue
/recall "how did we fix the RLS bug"
/recall dim_chw cross-source
```

This runs a semantic search across your session transcripts and returns matching sessions with relevance level, date, project, and transcript path. Useful for finding how you solved a problem before, or picking up where you left off on a previous task.

### Automation (Cron)

Run self-improvement automatically on a schedule:

**Weekly (recommended)** — every Sunday at 9 PM:

```bash
crontab -e
# Add this line:
0 21 * * 0 $HOME/.local/bin/claude-self-improve >> $HOME/.local/share/claude-improve/cron.log 2>&1
```

**Daily** — every day at 9 PM:

```bash
0 21 * * * $HOME/.local/bin/claude-self-improve >> $HOME/.local/share/claude-improve/cron.log 2>&1
```

**Check logs:**

```bash
tail -50 ~/.local/share/claude-improve/cron.log
```

> **Note:** Ensure `claude` (Claude Code CLI) is on the cron `PATH`. If runs fail, add `export PATH="$HOME/.local/bin:$PATH"` before the command in your crontab, or use the full path to `claude` in the script.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_MEMORY_DIR` | Auto-detected | Path to your Claude Code memory directory |
| `CLAUDE_IMPROVE_DATA_DIR` | `~/.local/share/claude-improve` | Where analysis data is stored |

### Custom Memory Directory

If auto-detection doesn't find the right project:

```bash
claude-self-improve --memory-dir ~/.claude/projects/my-project/memory
```

Or set it permanently:

```bash
export CLAUDE_MEMORY_DIR="$HOME/.claude/projects/my-project/memory"
```

## Output

After each run, the system produces:

| File | Description |
|------|-------------|
| `MEMORY.md` | Updated persistent memory (loaded by Claude Code) |
| `topic-files/*.md` | Detailed content that would bloat MEMORY.md |
| `metrics.jsonl` | Time-series of friction rates and satisfaction scores |
| `claude-md-suggestions.md` | Suggested additions to your CLAUDE.md project instructions |
| `analysis.json` | Full analysis output from the latest run |
| `run.log` | Execution log |

## Cost

The system uses headless Claude (Sonnet) for analysis. Typical costs:

| Stage | Model | Budget Cap | Typical Cost |
|-------|-------|-----------|--------------|
| Refresh (per session) | Haiku | $0.05 | ~$0.01 |
| Refresh (50 sessions) | Haiku | $2.50 | ~$0.50 |
| Analyze | Sonnet | $1.00 | $0.05–0.15 |
| Update | Sonnet | $0.30 | $0.02–0.05 |
| Meta-analysis (every 5th run) | Sonnet | $0.50 | $0.10–0.20 |
| **Total per run** | | **$4.30** | **$0.15–0.90** |

Running weekly costs roughly **$1–3/month**. Stage 0 only runs when facets are stale (>1h old) and only generates facets for sessions that don't have them, so most incremental runs process 0–5 sessions.

## How Facets Work

Session facets are JSON summaries of each Claude Code conversation. They can come from two sources:

1. **`/insights`** — Claude Code's built-in command generates facets in batch when you run it
2. **Stage 0 (auto-generate)** — Self-improve generates missing facets from session transcripts via Haiku

Stage 0 checks for staleness: if facets were recently generated (by `/insights` or a previous run), it skips generation. Self-generated facets are tagged with `"source": "self-improve"` to distinguish them.

Each facet includes:

- `friction_counts` — Types and counts of friction events (8 canonical types)
- `friction_detail` — Free-text description of what went wrong
- `outcome` — Whether the task was fully/mostly/partially achieved
- `user_satisfaction_counts` — Satisfaction signals
- `primary_success` — What Claude did well
- `session_complexity` — Low/medium/high task difficulty rating
- `recovery_quality` — How well Claude self-corrected after friction
- `context_switches` — Number of topic transitions in the session
- `root_cause_depth` — Surface/moderate/deep for debugging sessions
- `brief_summary` — One-line session summary

The self-improvement system reads these facets to find patterns across sessions.

## Customizing Prompts

The analysis and update prompts are in `~/.local/share/claude-improve/prompts/`:

- `generate-facet.md` — Controls how session transcripts are summarized into facets (Stage 0)
- `analyze.md` — Controls what patterns to look for and output format (Stage 2)
- `update-memory.md` — Controls how MEMORY.md is updated (Stage 3)
- `meta-analysis.md` — Controls system self-evaluation (Stage 4)
- `recall.md` — Controls session search behavior
- `optimize-prompts.md` — Controls prompt quality auditing

Edit these to change what the system tracks or how it writes memories.

## Example Output

Here's what a bootstrap run looks like (analyzing 52 Claude Code sessions):

```
═══════════════════════════════════════════════════
  CLAUDE SELF-IMPROVEMENT RUN
  Mode: BOOTSTRAP
  Interactive: false | Dry-run: false
═══════════════════════════════════════════════════
Stage 0: Checking for sessions without facets...
  Facets are 25h stale.
  Tip: Run /insights in Claude Code for faster facet generation.
  Found 8 sessions without facets. Generating via Haiku...
  [1/8] Generating facet for e82ff44f-5add...
  [2/8] Generating facet for a0113c39-9627...
  ...
  Generated 8 new facets.
Stage 0 complete.
Stage 1: Collecting session data...
  Total facets on disk: 60
  Bootstrap mode: processing ALL 60 facets
  Collected 60 facets
  Payload assembled: 60 facets, 109 memory lines
Stage 1 complete.

Stage 2: Analyzing session data with headless Claude...

  Analysis Results:
  ─────────────────────────────
  Sessions analyzed:  52
  Friction rate:      0.42
  Trend:              stable
  Memory updates:     4 proposed
  CLAUDE.md suggests: 3

Stage 2 complete.

Stage 3: Updating memory files...
  Backup saved to: ~/.local/share/claude-improve/backups/MEMORY_20260210_231500.md
  MEMORY.md updated: 109 → 115 lines
Stage 3 complete.

═══════════════════════════════════════════════════
  SELF-IMPROVEMENT RUN COMPLETE
  Sessions: 52 | Friction: 0.42 | Trend: stable
  Memory updates: 4 applied
═══════════════════════════════════════════════════
```

In this run, the system:
- Auto-generated 8 missing facets via Haiku (Stage 0)
- Analyzed 60 sessions and found a 42% friction rate
- Proposed 4 memory updates (new anti-patterns, lessons, and preferences)
- Suggested 3 additions to the project's CLAUDE.md
- Backed up existing memory before applying changes

## MCP Server (Claude.ai Desktop App)

The `mcp-server/` directory contains an MCP server that brings self-improvement to **Claude.ai Desktop App** users. Instead of batch post-hoc analysis, it uses inline reflection — Claude generates facets during the conversation.

Both the bash script and MCP server share the same SQLite database (`~/.claude-improve/facets.db`).

See [`mcp-server/README.md`](mcp-server/README.md) for setup instructions.

```bash
# Quick start
cd mcp-server && npm install
npx claude-improve-mcp init
npx claude-improve-mcp migrate  # import existing facets
```

## License

MIT
