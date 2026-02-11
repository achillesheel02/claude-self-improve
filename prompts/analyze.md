# Self-Improvement Analysis Prompt

You are analyzing Claude Code session performance data to extract actionable self-improvement insights.

## Input

You will receive a JSON payload with:
- `facets`: Array of session facet objects (each has `friction_counts`, `friction_detail`, `outcome`, `user_satisfaction_counts`, `primary_success`, `brief_summary`, `underlying_goal`, `goal_categories`, `session_id`)
- `current_memory`: Current contents of MEMORY.md
- `memory_line_count`: Current line count of MEMORY.md
- `previous_metrics`: Last 12 metrics snapshots (may be empty on first run)
- `is_bootstrap`: Whether this is the first run processing all historical data

## Analysis Steps

1. **Parse friction patterns**: For each facet, extract `friction_counts` (keyed by type like `wrong_approach`, `misunderstood_request`, `unnecessary_changes`, etc.) and `friction_detail` (free text explanation). Group similar friction events across sessions and count frequency.

2. **Assess outcomes and satisfaction**: Tally `outcome` values (`fully_achieved`, `mostly_achieved`, `partially_achieved`, `not_achieved`, `unclear_from_transcript`). Tally `user_satisfaction_counts` across all sessions.

3. **Identify success patterns**: Group `primary_success` values and correlate with high satisfaction sessions. What does Claude do well?

4. **Compare against existing memory**: Read `current_memory` carefully. Do NOT suggest adding anything that is already captured there (even if worded differently). Only suggest genuinely new insights.

5. **Detect trends**: If `previous_metrics` is available, compare current friction rates and satisfaction against historical values. Is friction improving, worsening, or stable?

6. **Extract user preferences**: From satisfaction patterns and friction details, infer working style preferences. What triggers dissatisfaction? What correlates with high satisfaction?

7. **Identify domain lessons**: Any technical lessons from session summaries that aren't already in MEMORY.md.

8. **Extract active threads**: Group sessions by recurring project/initiative themes using `underlying_goal` and `brief_summary`. An active thread is a topic that appears in 2+ sessions and represents ongoing work (not a one-off task). Examples: "marketing claude-self-improve", "Power BI RLS rollout", "dbt pipeline reliability". Capture the thread name, session count, last activity date, and current status (active/completed/stalled).

9. **Effectiveness analysis**: Compare this run's per-friction-type rates against `previous_metrics` to determine whether memory updates are actually reducing friction.
   - If `previous_metrics` has 2+ entries, compute the average friction rate and per-type counts from the oldest half ("baseline") and compare against the newest half + current run ("recent").
   - For each friction type, compute delta (recent - baseline). Negative = improving.
   - Correlate improvements with specific `memory_updates` or `claude_md_suggestions` from previous runs (listed in `current_memory`) — e.g., if "investigation-first rule" was added and `wrong_approach` dropped, flag as `likely_effective`.
   - If `previous_metrics` has <2 entries (bootstrap or early runs), set `has_baseline: false` and skip comparison. This run becomes the baseline for future comparisons.
   - Overall verdict: `improving` (aggregate friction rate dropped >5%), `stable` (within +/-5%), `regressing` (rose >5%), or `insufficient_data`.

## Output Format

Return ONLY valid JSON (no markdown code fences, no commentary):

```json
{
  "sessions_analyzed": 10,
  "friction_summary": {
    "total_friction_events": 25,
    "friction_rate": 0.41,
    "top_types": [
      {"type": "wrong_approach", "count": 12, "pct": 0.48, "trend": "stable"},
      {"type": "unnecessary_changes", "count": 5, "pct": 0.20, "trend": "improving"}
    ]
  },
  "satisfaction_summary": {
    "satisfied": 15,
    "likely_satisfied": 20,
    "dissatisfied": 5,
    "avg_score": 3.2
  },
  "outcome_summary": {
    "fully_achieved": 8,
    "mostly_achieved": 12,
    "partially_achieved": 3,
    "not_achieved": 1
  },
  "memory_updates": [
    {
      "operation": "append_to_section",
      "section": "Anti-Patterns",
      "content": "- **Premature diagnosis** (seen in 12 sessions): Always run a diagnostic query before stating root cause",
      "reason": "Most frequent friction pattern, not currently captured"
    },
    {
      "operation": "create_topic_file",
      "filename": "friction-history.md",
      "content": "# Friction History\n\n## 2026-02-10 (Bootstrap)\n- Total sessions: 52\n- Friction rate: 41%\n...",
      "reason": "Detailed friction metrics would bloat MEMORY.md"
    }
  ],
  "claude_md_suggestions": [
    {
      "suggestion": "Add rule: When investigating data issues, always query the table schema before writing SQL",
      "evidence": "wrong_approach friction in 5+ sessions involved incorrect column assumptions",
      "sessions_seen": 5
    }
  ],
  "active_threads": [
    {
      "thread": "Marketing claude-self-improve",
      "sessions": 3,
      "last_seen": "2026-02-11",
      "status": "active",
      "summary": "Discussed launch strategy, README improvements, cron automation docs"
    }
  ],
  "effectiveness": {
    "has_baseline": true,
    "baseline_runs": 3,
    "baseline_friction_rate": 0.42,
    "current_friction_rate": 0.35,
    "friction_rate_delta": -0.07,
    "satisfaction_delta": 0.3,
    "outcome_delta": 0.05,
    "per_type_changes": [
      {"type": "wrong_approach", "baseline_count": 12, "current_count": 7, "delta": -5, "verdict": "improving"},
      {"type": "misunderstood_request", "baseline_count": 8, "current_count": 9, "delta": 1, "verdict": "stable"}
    ],
    "likely_effective_updates": [
      "Investigation-first rule (CLAUDE.md) → wrong_approach -5 sessions"
    ],
    "overall_verdict": "improving"
  },
  "metrics": {
    "timestamp": "2026-02-10T20:00:00Z",
    "sessions_analyzed": 10,
    "friction_rate": 0.41,
    "avg_satisfaction": 3.2,
    "top_friction": "wrong_approach",
    "top_success": "good_debugging",
    "outcome_success_rate": 0.80,
    "friction_by_type": {
      "wrong_approach": 12,
      "misunderstood_request": 8,
      "unnecessary_changes": 3,
      "buggy_code": 2
    },
    "outcome_counts": {
      "fully_achieved": 8,
      "mostly_achieved": 12,
      "partially_achieved": 3,
      "not_achieved": 1
    }
  },
  "trend": "stable"
}
```

## Rules

1. **MEMORY.md budget**: The file must stay under 200 lines. Currently at `memory_line_count` lines. Plan updates accordingly — if adding content would exceed the limit, move verbose content to topic files.

2. **Never remove existing content**: Only add or refine. If an existing lesson is incomplete, suggest an `append_to_section` that adds nuance, don't replace it.

3. **Skip duplicates**: If MEMORY.md already captures an insight, don't suggest adding it again — even if worded differently.

4. **Be specific**: Good: "Always query table schema before writing SQL against unfamiliar tables". Bad: "Be more careful with queries".

5. **Weight recent sessions more**: If analyzing many sessions, give 2x weight to the most recent 10 sessions for trend analysis.

6. **Minimum evidence threshold**: Only include `claude_md_suggestions` for patterns seen in 3+ sessions. Memory updates need 2+ sessions OR 1 high-severity friction event.

7. **Friction types to look for**:
   - `wrong_approach` — Started with wrong hypothesis/tool/strategy
   - `misunderstood_request` — Didn't understand what user wanted
   - `unnecessary_changes` — Made changes user didn't ask for
   - `wasted_time` — Spent time on wrong path before correcting
   - `forgot_workflow_step` — Missed a step in established workflow
   - `tool_misuse` — Used wrong tool or wrong tool flags
   - `over_engineering` — Added unnecessary complexity

8. **Success types to track**:
   - `good_debugging` — Effective root cause analysis
   - `multi_file_changes` — Well-coordinated multi-file edits
   - `proactive_documentation` — Created docs/tickets without being asked
   - `efficient_workflow` — Completed task with minimal friction

9. **Active thread detection**: Group `underlying_goal` and `brief_summary` across sessions to identify recurring project themes. A thread needs 2+ sessions to qualify. Mark threads as: `active` (seen in last 5 sessions), `stalled` (not seen in last 10 sessions), or `completed` (explicit completion signals in summary). Compare against existing `## Active Threads` section in MEMORY.md — update existing threads, add new ones, mark completed ones.
