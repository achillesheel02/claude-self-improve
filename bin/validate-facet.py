#!/usr/bin/env python3
"""Strict schema validation and coercion for claude-self-improve facets.

Reads a facet JSON from stdin (or file path as argv[1]), enforces the canonical
schema by mapping non-standard values to their closest valid equivalents, and
writes the cleaned facet to stdout (or back to the file if --in-place).

Usage:
    echo '{"friction_counts": {"infrastructure_issues": 1}}' | python3 validate-facet.py
    python3 validate-facet.py /path/to/facet.json --in-place
    python3 validate-facet.py /path/to/facet.json --in-place --session-id ABC --facet-model sonnet
"""

import sys
import json
import re
import argparse

# ── Canonical Schema ─────────────────────────────────────────────────────────

VALID_OUTCOMES = {
    'fully_achieved', 'mostly_achieved', 'partially_achieved',
    'not_achieved', 'unclear_from_transcript'
}

VALID_FRICTION = {
    'wrong_approach', 'misunderstood_request', 'unnecessary_changes',
    'wasted_time', 'forgot_workflow_step', 'tool_misuse',
    'over_engineering', 'buggy_code'
}

VALID_HELPFULNESS = {'very_helpful', 'helpful', 'somewhat_helpful', 'not_helpful'}

VALID_SESSION_TYPES = {
    'quick_fix', 'iterative_refinement', 'exploration',
    'debugging', 'documentation'
}

VALID_SATISFACTION = {'happy', 'satisfied', 'likely_satisfied', 'dissatisfied'}

VALID_SUCCESS = {
    'good_debugging', 'multi_file_changes', 'proactive_help',
    'correct_code_edits', 'good_explanations', 'fast_accurate_search',
    'efficient_workflow'
}

VALID_COMPLEXITY = {'low', 'medium', 'high'}

VALID_RECOVERY = {'excellent', 'good', 'partial', 'poor', 'not_applicable'}

VALID_ROOT_CAUSE_DEPTH = {'surface', 'moderate', 'deep', 'not_applicable'}

# ── Coercion Maps ────────────────────────────────────────────────────────────

FRICTION_MAP = {
    'infrastructure_failure': 'tool_misuse',
    'infrastructure_issues': 'tool_misuse',
    'excessive_changes': 'unnecessary_changes',
    'missed_workflow_step': 'forgot_workflow_step',
    'fabricated_data': 'buggy_code',
    'tool_limitation': 'tool_misuse',
    'user_rejected_action': 'unnecessary_changes',
    'incomplete_fix': 'buggy_code',
    'tool_timeout': 'tool_misuse',
    'external_tool_issue': 'tool_misuse',
    'api_errors': 'tool_misuse',
    'missing_context': 'misunderstood_request',
    'environment_setup': 'tool_misuse',
    'tool_environment_issue': 'tool_misuse',
    'missed_content': 'wrong_approach',
    'incomplete_validation': 'buggy_code',
    'incomplete_answer': 'wrong_approach',
    'premature_action': 'wrong_approach',
    'communication_error': 'misunderstood_request',
    'incorrect_assumption': 'wrong_approach',
    'scope_creep': 'unnecessary_changes',
    'excessive_output': 'over_engineering',
    'verbose_output': 'over_engineering',
    'wrong_tool': 'tool_misuse',
    'wrong_file': 'wrong_approach',
    'permission_error': 'tool_misuse',
}

HELPFULNESS_MAP = {
    'essential': 'very_helpful',
    'extremely_helpful': 'very_helpful',
    'moderately_helpful': 'somewhat_helpful',
    'slightly_helpful': 'not_helpful',
    'unhelpful': 'not_helpful',
}

SESSION_TYPE_MAP = {
    'multi_task': 'iterative_refinement',
    'single_task': 'quick_fix',
    'monitoring': 'exploration',
    'investigation': 'exploration',
    'quick_question': 'quick_fix',
    'data_analysis': 'exploration',
    'code_review': 'exploration',
    'deployment': 'iterative_refinement',
    'configuration': 'quick_fix',
    'troubleshooting': 'debugging',
}

SATISFACTION_MAP = {
    'neutral': 'likely_satisfied',
    'concerned': 'dissatisfied',
    'frustrated': 'dissatisfied',
    'impressed': 'happy',
    'relieved': 'satisfied',
}


def validate_facet(data: dict) -> tuple[dict, int]:
    """Validate and coerce a facet dict. Returns (cleaned_data, coercion_count)."""
    coercions = 0

    # Outcome
    if data.get('outcome') not in VALID_OUTCOMES:
        data['outcome'] = 'unclear_from_transcript'
        coercions += 1

    # Helpfulness
    h = data.get('claude_helpfulness', '')
    if h not in VALID_HELPFULNESS:
        data['claude_helpfulness'] = HELPFULNESS_MAP.get(h, 'helpful')
        coercions += 1

    # Session type
    st = data.get('session_type', '')
    if st not in VALID_SESSION_TYPES:
        data['session_type'] = SESSION_TYPE_MAP.get(st, 'exploration')
        coercions += 1

    # Friction counts — map non-standard keys, merge counts
    fc = data.get('friction_counts', {})
    if not isinstance(fc, dict):
        fc = {}
    cleaned_fc = {}
    for k, v in fc.items():
        if not isinstance(v, (int, float)):
            continue
        v = int(v)
        if v <= 0:
            continue
        if k in VALID_FRICTION:
            cleaned_fc[k] = cleaned_fc.get(k, 0) + v
        elif k in FRICTION_MAP:
            mapped = FRICTION_MAP[k]
            cleaned_fc[mapped] = cleaned_fc.get(mapped, 0) + v
            coercions += 1
        else:
            # Unknown friction type — map to wrong_approach as catch-all
            cleaned_fc['wrong_approach'] = cleaned_fc.get('wrong_approach', 0) + v
            coercions += 1
    data['friction_counts'] = cleaned_fc

    # Satisfaction counts — map non-standard keys
    sat = data.get('user_satisfaction_counts', {})
    if not isinstance(sat, dict):
        sat = {}
    cleaned_sat = {}
    for k, v in sat.items():
        if not isinstance(v, (int, float)):
            continue
        v = int(v)
        if v <= 0:
            continue
        if k in VALID_SATISFACTION:
            cleaned_sat[k] = cleaned_sat.get(k, 0) + v
        elif k in SATISFACTION_MAP:
            mapped = SATISFACTION_MAP[k]
            cleaned_sat[mapped] = cleaned_sat.get(mapped, 0) + v
            coercions += 1
        else:
            cleaned_sat['likely_satisfied'] = cleaned_sat.get('likely_satisfied', 0) + v
            coercions += 1
    data['user_satisfaction_counts'] = cleaned_sat

    # Primary success
    if data.get('primary_success') not in VALID_SUCCESS:
        data['primary_success'] = 'efficient_workflow'
        coercions += 1

    # New enhanced fields — set defaults if missing (backward compatible)
    if data.get('session_complexity') not in VALID_COMPLEXITY:
        if 'session_complexity' in data:
            coercions += 1
        data.setdefault('session_complexity', 'medium')

    if data.get('recovery_quality') not in VALID_RECOVERY:
        if 'recovery_quality' in data:
            coercions += 1
        # Default based on friction presence
        if not cleaned_fc:
            data.setdefault('recovery_quality', 'not_applicable')
        else:
            data.setdefault('recovery_quality', 'good')

    if 'context_switches' not in data or not isinstance(data.get('context_switches'), (int, float)):
        data.setdefault('context_switches', 0)

    if data.get('root_cause_depth') not in VALID_ROOT_CAUSE_DEPTH:
        if 'root_cause_depth' in data:
            coercions += 1
        data.setdefault('root_cause_depth', 'not_applicable')

    return data, coercions


def main():
    parser = argparse.ArgumentParser(description='Validate and coerce facet JSON')
    parser.add_argument('file', nargs='?', help='Facet JSON file (reads stdin if omitted)')
    parser.add_argument('--in-place', action='store_true', help='Write back to file')
    parser.add_argument('--session-id', help='Set session_id field')
    parser.add_argument('--facet-model', help='Set facet_model field')
    parser.add_argument('--source', default='self-improve', help='Set source field')
    parser.add_argument('--quiet', action='store_true', help='Suppress coercion count output')
    args = parser.parse_args()

    # Read input
    if args.file:
        with open(args.file) as f:
            raw = f.read()
    else:
        raw = sys.stdin.read()

    raw = raw.strip()

    # Strip markdown code fences
    raw = re.sub(r'^```(?:json)?\s*\n?', '', raw)
    raw = re.sub(r'\n?```\s*$', '', raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    # Set metadata
    if args.session_id:
        data['session_id'] = args.session_id
    if args.facet_model:
        data['facet_model'] = args.facet_model
    data['source'] = args.source

    # Validate and coerce
    data, coercions = validate_facet(data)

    if not args.quiet and coercions > 0:
        print(f"  Coerced {coercions} non-standard values", file=sys.stderr)

    # Output
    output = json.dumps(data, indent=2)
    if args.in_place and args.file:
        with open(args.file, 'w') as f:
            f.write(output + '\n')
    else:
        print(output)


if __name__ == '__main__':
    main()
