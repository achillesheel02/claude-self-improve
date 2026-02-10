# claude-self-improve

A self-improvement system for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Analyzes your session performance data to automatically extract patterns, identify friction points, and update Claude's persistent memory — so it gets better at helping you over time.

![demo](demo.gif)

## How It Works

Claude Code stores session performance data as "facets" — JSON files capturing outcomes, friction events, and satisfaction signals. This system:

1. **Collects** new session facets since the last run
2. **Analyzes** them with headless Claude (Sonnet) to extract patterns
3. **Updates** your MEMORY.md with new lessons, anti-patterns, and preferences

```
┌─────────────────────────┐
│   Claude Code Sessions  │
│   (your daily usage)    │
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
- `~/.claude/commands/self-improve.md` — slash command for Claude Code

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

### Slash Command

Inside Claude Code:

```
/self-improve
```

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

| Stage | Budget Cap | Typical Cost |
|-------|-----------|--------------|
| Analyze | $0.50 | $0.05–0.15 |
| Update | $0.30 | $0.02–0.05 |
| **Total per run** | **$0.80** | **$0.07–0.20** |

Running weekly costs roughly **$0.50–1.00/month**.

## How Facets Work

Claude Code generates session facets automatically when you end a conversation. Each facet includes:

- `friction_counts` — Types and counts of friction events
- `friction_detail` — Free-text description of what went wrong
- `outcome` — Whether the task was fully/mostly/partially achieved
- `user_satisfaction_counts` — Satisfaction signals
- `primary_success` — What Claude did well
- `brief_summary` — One-line session summary

The self-improvement system reads these facets to find patterns across sessions.

## Customizing Prompts

The analysis and update prompts are in `~/.local/share/claude-improve/prompts/`:

- `analyze.md` — Controls what patterns to look for and output format
- `update-memory.md` — Controls how MEMORY.md is updated

Edit these to change what the system tracks or how it writes memories.

## Example Output

Here's what a bootstrap run looks like (analyzing 52 Claude Code sessions):

```
═══════════════════════════════════════════════════
  CLAUDE SELF-IMPROVEMENT RUN
  Mode: BOOTSTRAP
  Interactive: false | Dry-run: false
═══════════════════════════════════════════════════
Stage 1: Collecting session data...
  Total facets on disk: 52
  Bootstrap mode: processing ALL 52 facets
  Collected 52 facets
  Payload assembled: 52 facets, 109 memory lines
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
- Analyzed 52 sessions and found a 42% friction rate
- Proposed 4 memory updates (new anti-patterns, lessons, and preferences)
- Suggested 3 additions to the project's CLAUDE.md
- Backed up existing memory before applying changes

## License

MIT
