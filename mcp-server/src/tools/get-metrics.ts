import { getRecentMetrics, getLastAnalysisRun, getFacetCount } from "../db.js";

export interface GetMetricsInput {
  last_n?: number;
}

export interface MetricsResult {
  entries: object[];
  count: number;
  total_facets: number;
  trend: TrendSummary | null;
  last_run: object | null;
}

export interface TrendSummary {
  friction_rate_trend: "improving" | "stable" | "worsening";
  satisfaction_trend: "improving" | "stable" | "worsening";
  first_friction_rate: number;
  latest_friction_rate: number;
  first_satisfaction: number;
  latest_satisfaction: number;
}

export function getMetrics(input: GetMetricsInput): MetricsResult {
  const lastN = input.last_n || 12;

  // Read metrics from SQLite
  const entries = getRecentMetrics(lastN);
  const lastRun = getLastAnalysisRun();
  const totalFacets = getFacetCount();

  // Calculate trend
  let trend: TrendSummary | null = null;
  if (entries.length >= 2) {
    const first = entries[0] as any;
    const latest = entries[entries.length - 1] as any;

    const firstFR = first.friction_rate || 0;
    const latestFR = latest.friction_rate || 0;
    const firstSat = first.avg_satisfaction || 0;
    const latestSat = latest.avg_satisfaction || 0;

    const frDelta = latestFR - firstFR;
    const satDelta = latestSat - firstSat;

    trend = {
      friction_rate_trend:
        frDelta < -0.05 ? "improving" : frDelta > 0.05 ? "worsening" : "stable",
      satisfaction_trend:
        satDelta > 0.1 ? "improving" : satDelta < -0.1 ? "worsening" : "stable",
      first_friction_rate: firstFR,
      latest_friction_rate: latestFR,
      first_satisfaction: firstSat,
      latest_satisfaction: latestSat,
    };
  }

  return {
    entries,
    count: entries.length,
    total_facets: totalFacets,
    trend,
    last_run: lastRun,
  };
}
