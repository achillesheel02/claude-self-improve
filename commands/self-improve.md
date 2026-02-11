Run the Claude self-improvement system in interactive mode:

```bash
~/.local/bin/claude-self-improve --interactive
```

After the script completes, display:
1. **Sessions analyzed** — how many new sessions were processed
2. **Friction rate** — percentage of sessions with friction events
3. **Top friction patterns** — the most common types of friction
4. **Trend** — whether friction is improving, worsening, or stable
5. **Memory updates** — what was added to MEMORY.md and topic files

Then offer these follow-up actions:
- "View friction trend" — show the last 12 entries from `~/.local/share/claude-improve/metrics.jsonl`
- "Review CLAUDE.md suggestions" — show contents of `~/.local/share/claude-improve/claude-md-suggestions.md`
- "Open MEMORY.md" — read and display the updated MEMORY.md
- "Run bootstrap" — reprocess ALL sessions: `~/.local/bin/claude-self-improve --bootstrap --interactive`

If the script reports "No new sessions to analyze", suggest running with `--bootstrap` to reprocess all historical data.

**Note:** Stage 0 auto-generates facets for recent sessions that don't have them (via Haiku). This means you no longer need to run `/insights` first. Use `--no-refresh` to skip facet generation and use only existing facets.
