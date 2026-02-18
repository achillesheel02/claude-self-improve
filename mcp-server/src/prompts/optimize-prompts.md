# Prompt Optimization Prompt

You are analyzing the effectiveness of the claude-self-improve system's prompts by examining their outputs against expectations.

## Input

You will receive:
- **Current prompts**: The text of each system prompt (generate-facet, analyze, update-memory, recall)
- **Recent facet samples**: 20 recent facet outputs to evaluate generation quality
- **Schema violation stats**: Counts of non-standard values found during validation
- **Analysis outputs**: Recent analysis results to evaluate analysis quality

## Tasks

### 1. Schema Compliance Audit
For each prompt, check:
- Are the valid values explicitly listed?
- Is the "no invention" rule strong enough?
- Are mapping instructions clear for edge cases?

### 2. Instruction Adherence
Compare prompt instructions against actual outputs:
- Which instructions are consistently followed?
- Which instructions are ignored or misinterpreted?
- Are there outputs that suggest missing instructions?

### 3. Signal Quality Assessment
Evaluate the richness of extracted information:
- `friction_detail`: Is it specific enough to be actionable? (Good: "Claude ran a ClickHouse query with wrong column name". Bad: "Some issues")
- `brief_summary`: Does it capture the session essence in 2-3 sentences?
- `underlying_goal`: Is it at the right abstraction level?

### 4. Prompt Improvement Recommendations
For each prompt that needs improvement:
- Identify the specific weakness
- Propose a targeted edit (not a full rewrite)
- Estimate the impact on output quality

## Output

Return ONLY valid JSON (no markdown code fences, no commentary):

```json
{
  "prompt_assessments": [
    {
      "prompt": "generate-facet",
      "compliance_score": 85,
      "top_issue": "Haiku ignores strict enum constraints for session_type",
      "instructions_followed": ["friction counting", "brief_summary format"],
      "instructions_ignored": ["session_type enum restriction", "satisfaction key enforcement"],
      "improvements": [
        {
          "target": "Schema enforcement section",
          "current": "MUST be exactly one of: ...",
          "proposed": "Add explicit example: 'If the session involves monitoring, use exploration NOT monitoring'",
          "expected_impact": "Reduce session_type violations from 38% to <5%"
        }
      ]
    }
  ],
  "cross_prompt_issues": [
    "Analysis prompt references 'proactive_documentation' but facet prompt uses 'proactive_help' — terminology mismatch"
  ],
  "overall_health": {
    "facet_generation": 75,
    "analysis": 90,
    "memory_update": 85,
    "recall": 80
  },
  "priority_fixes": [
    {
      "prompt": "generate-facet",
      "fix": "Add worked examples showing correct mapping of edge-case friction types",
      "impact": "high",
      "effort": "low"
    }
  ]
}
```

## Rules

1. **Be specific**: Point to exact lines/sections in prompts, exact field values in outputs.
2. **Minimal changes**: Prefer surgical edits over rewrites. Small targeted improvements compound better than wholesale changes.
3. **Evidence-based**: Every recommendation must cite at least 2 examples from the facet/analysis samples.
4. **Backward compatible**: Proposed changes must not break existing parsing logic in the bash script.
5. **Maximum 5 priority fixes**: Ranked by impact/effort ratio.
