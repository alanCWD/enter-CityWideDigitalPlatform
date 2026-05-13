import { crm } from "./crm";
import type { HealthCategory, HealthStatus } from "./healthCatalog";

export interface HealthCheckRow {
  client_id: string;
  agency_id: string;
  key: string;
  category: HealthCategory;
  status: HealthStatus;
  weight: number;
  auto: 0 | 1;
  client_visible: 0 | 1;
  evidence: string | null;
  evidence_url: string | null;
  metric_value: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface HealthAuditRow {
  id: string;
  client_id: string;
  url: string;
  strategy: "mobile" | "desktop";
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  best_practices: number | null;
  lcp_ms: number | null;
  cls: number | null;
  inp_ms: number | null;
  cwv_pass: number | null;
  error: string | null;
  raw_report_url: string | null;
  created_at: string;
}

export type HealthBucket = "critical" | "needs_work" | "healthy" | "excellent";

export interface HealthSummary {
  score: number;
  bucket: HealthBucket;
  label: string;
  checks: HealthCheckRow[];
  audits: HealthAuditRow[];
}

export const fetchHealthSummary = (clientId: string) =>
  crm<HealthSummary>("health.summary", { client_id: clientId });

export const refreshAutoChecks = (clientId: string) =>
  crm<HealthSummary & { ok: true }>("health.refreshAuto", { client_id: clientId });

export const runLighthouse = (clientId: string, url?: string) =>
  crm<HealthSummary & { ok: true; mobile: unknown; desktop: unknown }>("health.runLighthouse", { client_id: clientId, url });

export interface CitationProbeResult {
  key: string;
  name: string;
  status: HealthStatus;
  listing_url: string | null;
  evidence: string;
}

export const runCitations = (clientId: string) =>
  crm<HealthSummary & { ok: true; results: CitationProbeResult[] }>("health.runCitations", { client_id: clientId });

export const toggleCheck = (clientId: string, key: string, status: HealthStatus, opts?: { evidence?: string; client_visible?: boolean }) =>
  crm<HealthSummary & { ok: true }>("health.toggleCheck", { client_id: clientId, key, status, ...opts });

export const setMetric = (clientId: string, key: string, metric: string) =>
  crm<{ ok: true }>("health.setMetric", { client_id: clientId, key, metric });

export const BUCKET_COLOR: Record<HealthBucket, { bg: string; text: string; ring: string; soft: string }> = {
  critical:   { bg: "#EF4444", text: "#FECACA", ring: "rgba(239,68,68,0.4)",   soft: "rgba(239,68,68,0.12)" },
  needs_work: { bg: "#F97316", text: "#FED7AA", ring: "rgba(249,115,22,0.4)", soft: "rgba(249,115,22,0.12)" },
  healthy:    { bg: "#0078D7", text: "#BFDBFE", ring: "rgba(0,120,215,0.4)",  soft: "rgba(0,120,215,0.12)" },
  excellent:  { bg: "#22C55E", text: "#BBF7D0", ring: "rgba(34,197,94,0.4)",  soft: "rgba(34,197,94,0.12)" },
};

export const STATUS_COLOR: Record<HealthStatus, { bg: string; fg: string; label: string }> = {
  pass:    { bg: "rgba(34,197,94,0.15)",  fg: "#22C55E", label: "Pass" },
  warn:    { bg: "rgba(249,115,22,0.15)", fg: "#F97316", label: "Warn" },
  fail:    { bg: "rgba(239,68,68,0.15)",  fg: "#EF4444", label: "Fail" },
  unknown: { bg: "rgba(238,241,250,0.08)", fg: "#A8B0C2", label: "Unknown" },
  skipped: { bg: "rgba(238,241,250,0.05)", fg: "#6B7280", label: "Skipped" },
};
