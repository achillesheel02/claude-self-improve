/**
 * Strict schema validation and coercion for claude-self-improve facets.
 * Direct port of validate-facet.py (264 lines) to TypeScript.
 */

// ── Canonical Schema ─────────────────────────────────────────────────────────

const VALID_OUTCOMES = new Set([
  "fully_achieved",
  "mostly_achieved",
  "partially_achieved",
  "not_achieved",
  "unclear_from_transcript",
]);

const VALID_FRICTION = new Set([
  "wrong_approach",
  "misunderstood_request",
  "unnecessary_changes",
  "wasted_time",
  "forgot_workflow_step",
  "tool_misuse",
  "over_engineering",
  "buggy_code",
]);

const VALID_HELPFULNESS = new Set([
  "very_helpful",
  "helpful",
  "somewhat_helpful",
  "not_helpful",
]);

const VALID_SESSION_TYPES = new Set([
  "quick_fix",
  "iterative_refinement",
  "exploration",
  "debugging",
  "documentation",
]);

const VALID_SATISFACTION = new Set([
  "happy",
  "satisfied",
  "likely_satisfied",
  "dissatisfied",
]);

const VALID_SUCCESS = new Set([
  "good_debugging",
  "multi_file_changes",
  "proactive_help",
  "correct_code_edits",
  "good_explanations",
  "fast_accurate_search",
  "efficient_workflow",
]);

const VALID_COMPLEXITY = new Set(["low", "medium", "high"]);

const VALID_RECOVERY = new Set([
  "excellent",
  "good",
  "partial",
  "poor",
  "not_applicable",
]);

const VALID_ROOT_CAUSE_DEPTH = new Set([
  "surface",
  "moderate",
  "deep",
  "not_applicable",
]);

// ── Coercion Maps ────────────────────────────────────────────────────────────

const FRICTION_MAP: Record<string, string> = {
  infrastructure_failure: "tool_misuse",
  infrastructure_issues: "tool_misuse",
  excessive_changes: "unnecessary_changes",
  missed_workflow_step: "forgot_workflow_step",
  fabricated_data: "buggy_code",
  tool_limitation: "tool_misuse",
  user_rejected_action: "unnecessary_changes",
  incomplete_fix: "buggy_code",
  tool_timeout: "tool_misuse",
  external_tool_issue: "tool_misuse",
  api_errors: "tool_misuse",
  missing_context: "misunderstood_request",
  environment_setup: "tool_misuse",
  tool_environment_issue: "tool_misuse",
  missed_content: "wrong_approach",
  incomplete_validation: "buggy_code",
  incomplete_answer: "wrong_approach",
  premature_action: "wrong_approach",
  communication_error: "misunderstood_request",
  incorrect_assumption: "wrong_approach",
  scope_creep: "unnecessary_changes",
  excessive_output: "over_engineering",
  verbose_output: "over_engineering",
  wrong_tool: "tool_misuse",
  wrong_file: "wrong_approach",
  permission_error: "tool_misuse",
};

const HELPFULNESS_MAP: Record<string, string> = {
  essential: "very_helpful",
  extremely_helpful: "very_helpful",
  moderately_helpful: "somewhat_helpful",
  slightly_helpful: "not_helpful",
  unhelpful: "not_helpful",
};

const SESSION_TYPE_MAP: Record<string, string> = {
  multi_task: "iterative_refinement",
  single_task: "quick_fix",
  monitoring: "exploration",
  investigation: "exploration",
  quick_question: "quick_fix",
  data_analysis: "exploration",
  code_review: "exploration",
  deployment: "iterative_refinement",
  configuration: "quick_fix",
  troubleshooting: "debugging",
};

const SATISFACTION_MAP: Record<string, string> = {
  neutral: "likely_satisfied",
  concerned: "dissatisfied",
  frustrated: "dissatisfied",
  impressed: "happy",
  relieved: "satisfied",
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface Facet {
  session_id?: string;
  facet_model?: string;
  source?: string;
  underlying_goal?: string;
  goal_categories?: Record<string, number>;
  outcome?: string;
  user_satisfaction_counts?: Record<string, number>;
  claude_helpfulness?: string;
  session_type?: string;
  friction_counts?: Record<string, number>;
  friction_detail?: string;
  primary_success?: string;
  session_complexity?: string;
  recovery_quality?: string;
  context_switches?: number;
  root_cause_depth?: string;
  brief_summary?: string;
  [key: string]: unknown;
}

export interface ValidationResult {
  facet: Facet;
  coercions: number;
  errors: string[];
}

// ── Validator ────────────────────────────────────────────────────────────────

export function validateFacet(data: Facet): ValidationResult {
  let coercions = 0;
  const errors: string[] = [];

  // Outcome
  if (!VALID_OUTCOMES.has(data.outcome || "")) {
    data.outcome = "unclear_from_transcript";
    coercions++;
  }

  // Helpfulness
  const h = data.claude_helpfulness || "";
  if (!VALID_HELPFULNESS.has(h)) {
    data.claude_helpfulness = HELPFULNESS_MAP[h] || "helpful";
    coercions++;
  }

  // Session type
  const st = data.session_type || "";
  if (!VALID_SESSION_TYPES.has(st)) {
    data.session_type = SESSION_TYPE_MAP[st] || "exploration";
    coercions++;
  }

  // Friction counts — map non-standard keys, merge counts
  let fc = data.friction_counts;
  if (!fc || typeof fc !== "object") {
    fc = {};
  }
  const cleanedFc: Record<string, number> = {};
  for (const [k, v] of Object.entries(fc)) {
    if (typeof v !== "number" || v <= 0) continue;
    const intV = Math.floor(v);
    if (intV <= 0) continue;

    if (VALID_FRICTION.has(k)) {
      cleanedFc[k] = (cleanedFc[k] || 0) + intV;
    } else if (k in FRICTION_MAP) {
      const mapped = FRICTION_MAP[k];
      cleanedFc[mapped] = (cleanedFc[mapped] || 0) + intV;
      coercions++;
    } else {
      // Unknown friction type — map to wrong_approach as catch-all
      cleanedFc["wrong_approach"] = (cleanedFc["wrong_approach"] || 0) + intV;
      coercions++;
    }
  }
  data.friction_counts = cleanedFc;

  // Satisfaction counts — map non-standard keys
  let sat = data.user_satisfaction_counts;
  if (!sat || typeof sat !== "object") {
    sat = {};
  }
  const cleanedSat: Record<string, number> = {};
  for (const [k, v] of Object.entries(sat)) {
    if (typeof v !== "number" || v <= 0) continue;
    const intV = Math.floor(v);
    if (intV <= 0) continue;

    if (VALID_SATISFACTION.has(k)) {
      cleanedSat[k] = (cleanedSat[k] || 0) + intV;
    } else if (k in SATISFACTION_MAP) {
      const mapped = SATISFACTION_MAP[k];
      cleanedSat[mapped] = (cleanedSat[mapped] || 0) + intV;
      coercions++;
    } else {
      cleanedSat["likely_satisfied"] =
        (cleanedSat["likely_satisfied"] || 0) + intV;
      coercions++;
    }
  }
  data.user_satisfaction_counts = cleanedSat;

  // Primary success
  if (!VALID_SUCCESS.has(data.primary_success || "")) {
    data.primary_success = "efficient_workflow";
    coercions++;
  }

  // Session complexity
  if (!VALID_COMPLEXITY.has(data.session_complexity || "")) {
    if (data.session_complexity !== undefined) coercions++;
    if (data.session_complexity === undefined) {
      data.session_complexity = "medium";
    } else {
      data.session_complexity = "medium";
    }
  }

  // Recovery quality
  if (!VALID_RECOVERY.has(data.recovery_quality || "")) {
    if (data.recovery_quality !== undefined) coercions++;
    if (Object.keys(cleanedFc).length === 0) {
      data.recovery_quality = data.recovery_quality || "not_applicable";
    } else {
      data.recovery_quality = data.recovery_quality || "good";
    }
    // Ensure valid after default
    if (!VALID_RECOVERY.has(data.recovery_quality)) {
      data.recovery_quality = Object.keys(cleanedFc).length === 0
        ? "not_applicable"
        : "good";
    }
  }

  // Context switches
  if (
    data.context_switches === undefined ||
    typeof data.context_switches !== "number"
  ) {
    data.context_switches = 0;
  }

  // Root cause depth
  if (!VALID_ROOT_CAUSE_DEPTH.has(data.root_cause_depth || "")) {
    if (data.root_cause_depth !== undefined) coercions++;
    data.root_cause_depth = data.root_cause_depth || "not_applicable";
    if (!VALID_ROOT_CAUSE_DEPTH.has(data.root_cause_depth)) {
      data.root_cause_depth = "not_applicable";
    }
  }

  return { facet: data, coercions, errors };
}

/**
 * Parse raw JSON text (with optional markdown fences) into a facet object.
 */
export function parseFacetJson(raw: string): Facet {
  let text = raw.trim();

  // Strip markdown code fences
  text = text.replace(/^```(?:json)?\s*\n?/, "");
  text = text.replace(/\n?```\s*$/, "");

  return JSON.parse(text);
}
