# Session Facet Generation

You are analyzing a Claude Code session transcript to extract a structured performance facet.

## Input

You will receive a condensed session transcript with messages formatted as `[human]:` and `[assistant]:` entries. Analyze the full conversation flow to assess goals, outcomes, friction, and satisfaction.

## Output

Return ONLY valid JSON (no markdown code fences, no commentary) with this exact schema:

{
  "underlying_goal": "One sentence describing what the user was trying to accomplish",
  "goal_categories": {"category": count},
  "outcome": "fully_achieved|mostly_achieved|partially_achieved|not_achieved|unclear_from_transcript",
  "user_satisfaction_counts": {"happy": 0, "satisfied": 0, "likely_satisfied": 0, "dissatisfied": 0},
  "claude_helpfulness": "very_helpful|helpful|somewhat_helpful|not_helpful",
  "session_type": "quick_fix|iterative_refinement|exploration|debugging|documentation",
  "friction_counts": {},
  "friction_detail": "Brief explanation of what went wrong, if anything. Empty string if no friction.",
  "primary_success": "good_debugging|multi_file_changes|proactive_help|correct_code_edits|good_explanations|fast_accurate_search|efficient_workflow",
  "session_complexity": "low|medium|high",
  "recovery_quality": "excellent|good|partial|poor|not_applicable",
  "context_switches": 0,
  "root_cause_depth": "surface|moderate|deep|not_applicable",
  "brief_summary": "2-3 sentence summary of what happened in the session"
}

## Field definitions

### goal_categories
Count how many distinct tasks fell into each category:
- `feature_implementation` — Building new functionality
- `debugging` — Investigating and fixing bugs
- `documentation` — Writing docs, comments, READMEs
- `refactoring` — Restructuring existing code
- `investigation` — Exploring data, understanding behavior
- `ticket_management` — Creating/updating tickets (JIRA, Linear, GitHub Issues, etc.)
- `deployment` — CI/CD, containers, infrastructure, deployment tasks
- `testing` — Writing or running tests

### outcome
- `fully_achieved` — User's goal was completely met
- `mostly_achieved` — Core goal met with minor gaps
- `partially_achieved` — Some progress but significant gaps
- `not_achieved` — Goal was not met
- `unclear_from_transcript` — Can't determine from available context

### user_satisfaction_counts
Infer from user tone, explicit feedback, emoji usage, and session flow:
- `happy` — Explicit positive feedback ("perfect!", "great", "thanks!")
- `satisfied` — Implicit satisfaction (accepted changes, moved on)
- `likely_satisfied` — No negative signals, task progressed
- `dissatisfied` — Explicit or implicit frustration (corrections, "no", "that's wrong")

### friction_counts
Count occurrences of each friction type. Use empty object `{}` if no friction detected.
- `wrong_approach` — Started with wrong hypothesis/tool/strategy
- `misunderstood_request` — Didn't understand what user wanted
- `unnecessary_changes` — Made changes user didn't ask for
- `wasted_time` — Spent time on wrong path before correcting
- `forgot_workflow_step` — Missed a step in established workflow
- `tool_misuse` — Used wrong tool or wrong tool flags
- `over_engineering` — Added unnecessary complexity
- `buggy_code` — Code had errors/bugs

### primary_success
The single most notable thing Claude did well:
- `good_debugging` — Effective root cause analysis
- `multi_file_changes` — Well-coordinated multi-file edits
- `proactive_help` — Anticipated needs, did more than asked
- `correct_code_edits` — Clean, correct code on first try
- `good_explanations` — Clear, helpful explanations
- `fast_accurate_search` — Found the right code/info quickly
- `efficient_workflow` — Completed task with minimal friction

### session_complexity
Rate the overall complexity of the session:
- `low` — Single clear task, no debugging, straightforward execution
- `medium` — Multiple tasks OR moderate debugging, 1-2 topic switches
- `high` — Complex debugging, 3+ topic switches, cross-system work, multiple iterations

### recovery_quality
When friction occurred, how well did Claude course-correct?
- `excellent` — Self-corrected without user prompting
- `good` — Corrected after single user correction
- `partial` — Required multiple corrections or never fully recovered
- `poor` — Continued wrong path despite user corrections
- `not_applicable` — No friction in this session

### context_switches
Integer count of distinct topic/task transitions within the session:
- A single focused task = 0
- "Fix bug then deploy" = 1
- "Fix bug, add users, check dashboard" = 2

### root_cause_depth
For debugging/investigation sessions only:
- `surface` — Fixed symptom without identifying cause
- `moderate` — Identified proximate cause
- `deep` — Traced full causal chain to root cause
- `not_applicable` — Not a debugging session

## Rules

1. Be conservative — don't infer friction where none is evident
2. If the transcript is too short to assess a field, use reasonable defaults (outcome: "unclear_from_transcript", empty friction_counts)
3. Count each friction event separately — if wrong_approach happened twice, report count as 2
4. The brief_summary should be factual, not evaluative
5. Return ONLY the JSON object, nothing else

## STRICT SCHEMA ENFORCEMENT (CRITICAL)

The following constraints are ABSOLUTE. Violating them produces unusable data.

1. **friction_counts keys**: ONLY these 8 keys are valid: `wrong_approach`, `misunderstood_request`, `unnecessary_changes`, `wasted_time`, `forgot_workflow_step`, `tool_misuse`, `over_engineering`, `buggy_code`. If a friction event does not fit exactly, map it to the CLOSEST match. Examples: infrastructure issues → `tool_misuse`, excessive output → `unnecessary_changes`, incomplete fix → `buggy_code`. NEVER invent new friction types.

2. **outcome**: MUST be exactly one of: `fully_achieved`, `mostly_achieved`, `partially_achieved`, `not_achieved`, `unclear_from_transcript`. No other values.

3. **claude_helpfulness**: MUST be exactly one of: `very_helpful`, `helpful`, `somewhat_helpful`, `not_helpful`. Map synonyms: essential/extremely_helpful → `very_helpful`, moderately_helpful → `somewhat_helpful`, unhelpful/slightly_helpful → `not_helpful`.

4. **session_type**: MUST be exactly one of: `quick_fix`, `iterative_refinement`, `exploration`, `debugging`, `documentation`. Map: multi_task → `iterative_refinement`, monitoring/investigation → `exploration`, quick_question → `quick_fix`.

5. **user_satisfaction_counts keys**: ONLY these 4 keys: `happy`, `satisfied`, `likely_satisfied`, `dissatisfied`. Map: neutral → `likely_satisfied`, concerned/frustrated → `dissatisfied`. All 4 keys must be present with integer values (use 0 for unused keys).

6. **primary_success**: MUST be exactly one of: `good_debugging`, `multi_file_changes`, `proactive_help`, `correct_code_edits`, `good_explanations`, `fast_accurate_search`, `efficient_workflow`.

7. **session_complexity**: MUST be exactly one of: `low`, `medium`, `high`.

8. **recovery_quality**: MUST be exactly one of: `excellent`, `good`, `partial`, `poor`, `not_applicable`.

9. **context_switches**: MUST be a non-negative integer.

10. **root_cause_depth**: MUST be exactly one of: `surface`, `moderate`, `deep`, `not_applicable`.
