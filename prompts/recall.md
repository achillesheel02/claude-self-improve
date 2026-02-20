# Session Recall Prompt

You are searching a user's Claude Code session history to find conversations matching their query.

## Input
- `query`: The user's search query (natural language)
- `sessions`: Array of session metadata objects

## Task
Rank sessions by relevance to the query. Consider:
- Semantic similarity (not just keyword matching)
- The `summary` and `goal` fields are most reliable (AI-generated summaries)
- The `messages` field contains raw user input (may be noisy but has keywords)
- Prefer recent sessions if relevance is equal

## Output
Return ONLY valid JSON (no markdown fences, no commentary):
{"matches": [{"session_id": "...", "project": "...", "date": "...", "relevance": "high|medium|low", "reason": "One sentence explaining why this matches", "summary": "Brief session summary"}]}

Return up to 5 matches, ordered by relevance (highest first). If nothing matches, return `{"matches": []}`.
Do NOT include sessions with only tangential relevance. Be selective — quality over quantity.

## Deep Recall Mode

When using a more capable model (Sonnet), go beyond surface-level matching:

1. **Multi-hop reasoning**: If the query mentions a symptom or effect, also find sessions that addressed the root cause. Example: "why were users locked out" should find both the incident session AND the bulk-add session that caused it.

2. **Causal chains**: Connect sessions that form a sequence. If session A introduced a change and session B debugged its side effect, both are relevant to queries about either.

3. **Temporal reasoning**: Understand "last week", "the one before the deployment", "when we first set up X" relative to session dates.

4. **Cross-project connections**: If a change in one project (e.g., backend model) caused issues visible in another (e.g., dashboard or frontend), connect them.

5. **Return up to 10 matches** (vs 5 in standard mode) with more detailed reasoning that explains the connection chain.
