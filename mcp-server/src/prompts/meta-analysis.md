# Meta-Analysis Prompt

You are performing a meta-analysis of the claude-self-improve system itself. Your job is to evaluate whether the system's interventions (memory updates, CLAUDE.md suggestions, anti-pattern documentation) are actually working — reducing friction and improving outcomes over time.

## Input

You will receive:
- **Metrics history**: Time-series JSONL of past analysis runs (friction_rate, satisfaction, outcomes over time)
- **Current analysis**: Latest analysis output with friction patterns and memory updates
- **Current MEMORY.md**: The persistent memory file that drives Claude's behavior

## Tasks

### 1. Zombie Pattern Detection
Find anti-patterns documented in MEMORY.md that STILL appear in recent friction data. A "zombie" is a pattern that was documented 2+ runs ago but whose targeted friction type has NOT decreased. These represent documentation that isn't changing behavior.

For each zombie:
- Quote the MEMORY.md entry
- Show the friction count trend (before documentation vs after)
- Assess: Is the documentation insufficient? Wrong section? Too buried to be noticed?

### 2. Effectiveness Correlation
For each memory update applied in previous runs, check if the targeted friction type decreased in subsequent runs:
- Compare friction rates before vs after the update
- Account for natural variance (use 3-run moving average)
- Classify: `likely_effective`, `inconclusive`, `ineffective`

### 3. Stale Memory Detection
Identify MEMORY.md entries that may be ready for archival:
- References to closed JIRA tickets with no related friction in last 50 sessions
- Anti-patterns with 0 occurrences in last 3 analysis runs
- Technical lessons about systems/tools no longer in active use
- Entries that are duplicated or subsumed by newer, more specific entries

### 4. Facet Quality Assessment
If facets have a `facet_model` field, compare Sonnet vs Haiku generated facets:
- Average `friction_detail` length (richer = better signal)
- Schema compliance (non-standard values before validation)
- Friction detection rate (do Sonnet facets detect more or fewer friction events?)

### 5. System Health Score
Compute a 0-100 composite score:
- Friction rate trend (40% weight): improving = high, worsening = low
- Memory freshness (20% weight): % of entries updated in last 5 runs
- Zombie count (20% weight): fewer zombies = healthier
- Update effectiveness rate (20% weight): % of updates classified as likely_effective

## Output

Return ONLY valid JSON (no markdown code fences, no commentary):

```json
{
  "zombie_patterns": [
    {
      "pattern": "Wrong initial diagnosis",
      "memory_location": "## Anti-Patterns",
      "documented_since": "2026-02-10",
      "friction_type": "wrong_approach",
      "count_before": 12,
      "count_after": 11,
      "trend": "stable",
      "diagnosis": "Documentation exists but is too generic to change behavior"
    }
  ],
  "effective_updates": [
    {
      "update": "Added diagnostic query rule to CLAUDE.md",
      "target_friction": "wrong_approach",
      "before_rate": 0.48,
      "after_rate": 0.35,
      "verdict": "likely_effective"
    }
  ],
  "stale_entries": [
    {
      "entry": "DWM-175: Docker 29 containerd issue",
      "reason": "Closed ticket, no related friction in 50+ sessions",
      "recommendation": "archive_to_topic"
    }
  ],
  "facet_quality": {
    "sonnet_count": 50,
    "haiku_count": 200,
    "avg_detail_length_sonnet": 145,
    "avg_detail_length_haiku": 52,
    "sonnet_friction_detection_rate": 0.45,
    "haiku_friction_detection_rate": 0.38
  },
  "system_health_score": 72,
  "health_breakdown": {
    "friction_trend": 80,
    "memory_freshness": 65,
    "zombie_count": 60,
    "update_effectiveness": 75
  },
  "recommendations": [
    "Rewrite zombie pattern 'Wrong initial diagnosis' with more specific actionable steps",
    "Archive 3 stale entries related to closed DWM tickets",
    "Continue using Sonnet for facets — 2.8x richer friction detail"
  ]
}
```

## Rules

1. **Evidence-based only**: Every claim must cite specific metrics or facet data. No speculation.
2. **Conservative classification**: Mark updates as `likely_effective` only if the target friction type decreased by >15% over 3+ runs AND satisfaction didn't decrease.
3. **Don't recommend removing active lessons**: Even if a pattern hasn't occurred recently, if it's about a system still in use, keep it. Only flag entries about deprecated systems or completed one-off tasks.
4. **Actionable recommendations**: Each recommendation should be a specific, implementable action (not "improve memory quality").
5. **Maximum 10 recommendations**: Prioritize by expected impact on friction reduction.
