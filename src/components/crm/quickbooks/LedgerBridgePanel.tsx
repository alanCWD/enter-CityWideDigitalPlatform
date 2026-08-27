import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  CalendarClock,
  Table2,
  Unlink,
} from "lucide-react";

// TODO: replace this placeholder with the real LedgerBridge dashboard URL.
const LEDGERBRIDGE_DASHBOARD_URL = "https://ledgerbridge.example.com";

interface ConnInfo {
  connected?: boolean;
  environment?: string;
  detail?: string;
}

interface LogRow {
  id: string;
  date: string | null;
  status: string | null;
  totals: string | null;
}

interface StatusView {
  qb: ConnInfo;
  clover: ConnInfo;
  mapping: { status?: string; mapped?: number; total?: number };
  lastSync: string | null;
  logs: LogRow[];
  anyConnection: boolean;
  raw: unknown;
}

function pick(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  const rec = obj as Record<string, unknown>;
  for (const key of keys) {
    const v = rec[key];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function strVal(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function asConnInfo(obj: unknown): ConnInfo {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const rec = obj as Record<string, unknown>;
  return {
    connected: strVal(pick(rec, ["connected", "is_connected", "active", "linked"])) === "true",
    environment: strVal(pick(rec, ["environment", "env", "mode", "environment_type"])) ?? undefined,
    detail: strVal(pick(rec, [
      "realm", "realm_id", "company", "company_name",
      "merchant", "merchant_id", "merchant_name", "store", "store_name", "name",
    ])) ?? undefined,
  };
}

function formatTotals(row: Record<string, unknown>): string | null {
  const totals = pick(row, ["totals", "summary", "counts"]);
  if (totals && typeof totals === "object" && !Array.isArray(totals)) {
    const parts = Object.entries(totals as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}: ${v}`);
    if (parts.length) return parts.join("  ·  ");
  }
  const counters = ["invoices", "invoice_count", "sales", "orders", "payments", "imported", "created", "updated", "failed", "errors", "skipped"];
  const parts = counters
    .filter((c) => row[c] !== undefined && row[c] !== null)
    .map((c) => `${c}: ${row[c]}`);
  return parts.length ? parts.join("  ·  ") : null;
}

function normalizeStatus(raw: unknown): StatusView {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { qb: {}, clover: {}, mapping: {}, lastSync: null, logs: [], anyConnection: false, raw };
  }
  const rec = raw as Record<string, unknown>;

  const qb = asConnInfo(pick(rec, ["quickbooks", "qb", "qbo"]));
  const clover = asConnInfo(pick(rec, ["clover"]));

  const mappingObj = pick(rec, ["account_mapping", "accountMapping", "mapping"]);
  const mappingRec = mappingObj && typeof mappingObj === "object" && !Array.isArray(mappingObj)
    ? (mappingObj as Record<string, unknown>)
    : undefined;
  const mappingStatus = strVal(pick(mappingRec, ["status", "state"]))
    ?? strVal(pick(rec, ["mapping_status", "mappingStatus"]));
  const mapped = strVal(pick(mappingRec, ["mapped", "mapped_count", "mappedCount", "mapped_accounts"])) ?? undefined;
  const total = strVal(pick(mappingRec, ["total", "total_accounts", "totalAccounts"])) ?? undefined;

  const lastSync = strVal(pick(rec, ["last_sync", "lastSync", "last_sync_at", "lastSyncAt", "last_run", "lastRun", "last_synced_at"]));

  const logsRaw = pick(rec, ["sync_logs", "syncLogs", "recent_logs", "recentLogs", "logs", "sync_history", "runs"]);
  const logs = Array.isArray(logsRaw) ? (logsRaw as unknown[]) : [];
  const logRows: LogRow[] = logs
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object" && !Array.isArray(l))
    .slice(0, 10)
    .map((row, i) => {
      const date = strVal(pick(row, ["date", "at", "ran_at", "started_at", "created_at", "timestamp", "ts", "run_at"]));
      return {
        id: strVal(pick(row, ["id", "run_id"])) ?? `${i}-${date ?? ""}`,
        date,
        status: strVal(pick(row, ["status", "result", "state", "outcome"])),
        totals: formatTotals(row),
      };
    });

  return {
    qb,
    clover,
    mapping: { status: mappingStatus ?? undefined, mapped, total },
    lastSync,
    logs: logRows,
    anyConnection: !!qb.connected || !!clover.connected,
    raw,
  };
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusPill(status: string | null | undefined, okValue: string): { label: string; tone: "ok" | "warn" | "muted" } {
  const s = (status ?? "").toLowerCase();
  if (s === okValue.toLowerCase() || s === "ok" || s === "success" || s === "complete" || s === "completed" || s === "synced") {
    return { label: status ?? okValue, tone: "ok" };
  }
  if (s && (s.includes("fail") || s.includes("error") || s.includes("expired"))) {
    return { label: status ?? "Error", tone: "warn" };
  }
  if (!s) return { label: "Unknown", tone: "muted" };
  return { label: status, tone: "warn" };
}

function StatTile({ icon: Icon, title, value, sub, tone }: {
  icon: typeof CheckCircle2;
  title: string;
  value: string;
  sub?: string;
  tone: "ok" | "muted" | "warn";
}) {
  const dotClass =
    tone === "ok"
      ? "bg-[#22C55E]"
      : tone === "warn"
        ? "bg-amber-500"
        : "bg-muted-foreground/40";
  return (
    <div className="rounded-xl bg-muted/40 dark:bg-white/3 border border-border dark:border-white/8 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Icon className="w-3 h-3" /> {title}
        </p>
      </div>
      <p className="text-sm font-semibold text-foreground dark:text-[#EEF1FA] break-words">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{sub}</p>}
    </div>
  );
}

export function LedgerBridgePanel() {
  const [status, setStatus] = useState<StatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("ledgerbridge-status");
      if (invokeError) throw new Error(invokeError.message || "Failed to load LedgerBridge status");
      setStatus(normalizeStatus(data));
    } catch (e) {
      setError((e as Error).message || "Failed to load LedgerBridge status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connected = status?.qb.connected && status?.clover.connected;
  const partiallyConnected = status?.anyConnection && !connected;
  const hasData = status?.qb.connected || status?.clover.connected || !!status?.mapping.status || !!status?.lastSync || !!status?.logs.length;
  const unrecognized = !!status && !hasData;

  return (
    <div className="space-y-4">
      {/* Connection card */}
      <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider">
              LedgerBridge
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clover → QuickBooks daily sync status.
            </p>
          </div>
          {loading ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
            </span>
          ) : connected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </span>
          ) : partiallyConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <AlertCircle className="w-3.5 h-3.5" /> Partially Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
              <Unlink className="w-3.5 h-3.5" /> Not Connected
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground max-w-md">
            Sync runs once a day on LedgerBridge, an external project. Open its dashboard to view or manage the sync configuration.
          </p>
          <a
            href={LEDGERBRIDGE_DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-[#0078D7] hover:bg-[#005FA3] text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open LedgerBridge Dashboard
          </a>
        </div>
      </div>

      {/* Sync status widget */}
      <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider">
              Sync Status
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Latest snapshot from the LedgerBridge read-only API.
            </p>
          </div>
          <button
            onClick={load}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-[#0078D7] hover:bg-[#0078D7]/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/5 border border-red-500/20 px-4 py-3 mb-4">
            <p className="text-xs font-bold text-red-400 mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Could not load LedgerBridge status
            </p>
            <p className="text-xs text-red-400/80">{error}</p>
            <button
              onClick={load}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading LedgerBridge status…</span>
          </div>
        ) : unrecognized ? (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <ArrowRightLeft className="w-8 h-8 opacity-20" />
            <p className="text-sm">LedgerBridge returned an unexpected response shape.</p>
            <p className="text-xs opacity-70">Raw payload:</p>
            <pre className="max-w-full overflow-x-auto text-[11px] bg-muted/40 border border-border rounded-lg p-3 text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(status?.raw ?? null, null, 2)}
            </pre>
          </div>
        ) : status ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile
                icon={CheckCircle2}
                title="QuickBooks"
                value={status.qb.connected ? "Connected" : "Not connected"}
                sub={
                  status.qb.connected
                    ? [status.qb.environment, status.qb.detail].filter(Boolean).join(" · ") || undefined
                    : undefined
                }
                tone={status.qb.connected ? "ok" : "muted"}
              />
              <StatTile
                icon={CheckCircle2}
                title="Clover"
                value={status.clover.connected ? "Connected" : "Not connected"}
                sub={
                  status.clover.connected
                    ? [status.clover.environment, status.clover.detail].filter(Boolean).join(" · ") || undefined
                    : undefined
                }
                tone={status.clover.connected ? "ok" : "muted"}
              />
              <StatTile
                icon={ArrowRightLeft}
                title="Account Mapping"
                value={status.mapping.status || (status.mapping.mapped !== undefined ? "Mapped" : "No data")}
                sub={
                  status.mapping.mapped !== undefined && status.mapping.total !== undefined
                    ? `${status.mapping.mapped} of ${status.mapping.total} accounts`
                    : status.mapping.total !== undefined
                      ? `${status.mapping.total} accounts`
                      : undefined
                }
                tone={status.mapping.status && !/^(ok|complete|completed|synced|success)$/i.test(status.mapping.status) ? "warn" : "muted"}
              />
              <StatTile
                icon={CalendarClock}
                title="Last Sync"
                value={status.lastSync ? fmtDateTime(status.lastSync) : "Never"}
                tone={status.lastSync ? "ok" : "muted"}
              />
            </div>

            {/* Recent sync log */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <Table2 className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Recent Sync Runs
                </h4>
                <span className="text-xs text-muted-foreground">({status.logs.length})</span>
              </div>

              {status.logs.length === 0 ? (
                <div className="py-6 flex flex-col items-center gap-2 text-muted-foreground">
                  <CalendarClock className="w-6 h-6 opacity-20" />
                  <p className="text-sm">No sync runs recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border dark:border-white/8 bg-muted/30">
                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Date</th>
                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Status</th>
                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Totals</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-white/5">
                      {status.logs.map((row) => {
                        const pill = statusPill(row.status, "success");
                        return (
                          <tr key={row.id}>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {row.date ? fmtDateTime(row.date) : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  pill.tone === "ok"
                                    ? "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20"
                                    : pill.tone === "warn"
                                      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                      : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {pill.tone === "ok" ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                                {pill.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                              {row.totals || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <Unlink className="w-8 h-8 opacity-20" />
            <p className="text-sm">LedgerBridge is not connected.</p>
            <p className="text-xs opacity-70">Open the dashboard to set up the Clover → QuickBooks sync, then refresh this page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
