import { useState, useRef } from "react";
import Papa from "papaparse";
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { crm } from "@/lib/crm";

type RawRow = Record<string, string | undefined>;

interface NormalizedRow {
  name: string;
  status: "active" | "prospect";
  gbp_connection_id: string | null;
  billing_email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string;
  notes: string | null;
}

function pick(row: RawRow, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v && v.trim()) return v.trim();
  }
  return null;
}

function isYes(v: string | undefined | null) {
  return !!v && v.trim().toLowerCase() === "yes";
}

function normalize(row: RawRow): NormalizedRow {
  const name = pick(row, "CompanyName", "Company Name", "Name") ?? "";
  const localSeo = isYes(row["Local SEO"]);
  const socialMkt = isYes(row["Social Marketing"]);
  const repMgmt = isYes(row["Reputation Management"]);
  const isActive = localSeo || socialMkt || repMgmt;
  const services: string[] = [];
  if (localSeo) services.push("Local SEO");
  if (socialMkt) services.push("Social Marketing");
  if (repMgmt) services.push("Reputation Management");
  const website = pick(row, "Website", "WebSite");
  const notesParts: string[] = [];
  if (services.length) notesParts.push(`Services: ${services.join(", ")}`);
  if (website) notesParts.push(`Website: ${website}`);
  const sales = pick(row, "SalesPersonEmail");
  if (sales) notesParts.push(`Sales rep: ${sales}`);
  return {
    name,
    status: isActive ? "active" : "prospect",
    gbp_connection_id: pick(row, "AccountIdentifier", "CustomerIdentifier"),
    billing_email: pick(row, "SalesPersonEmail", "Email"),
    phone: pick(row, "WorkNumber", "Phone", "AdditionalWorkNumber1"),
    address_line1: pick(row, "Address", "AddressLine1"),
    address_line2: pick(row, "Address2", "AddressLine2"),
    city: pick(row, "City"),
    region: pick(row, "State", "Region", "Province"),
    postal_code: pick(row, "Zip", "PostalCode", "Postal Code"),
    country: pick(row, "CountryCode", "Country") ?? "CA",
    notes: notesParts.length ? notesParts.join(" • ") : null,
  };
}

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: Array<{ index: number; name?: string; message: string }>;
  error_count: number;
  total: number;
}

export function ImportClientsDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<NormalizedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);

  const onFileChange = (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setResult(null);
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      // Auto-detects tab vs comma but we hint:
      delimitersToGuess: ["\t", ",", ";", "|"],
      complete: (out) => {
        if (out.errors?.length) {
          const first = out.errors[0];
          if (first.code !== "TooFewFields" && first.code !== "TooManyFields") {
            setParseError(`${first.code}: ${first.message}`);
            return;
          }
        }
        const normalized = out.data.map(normalize).filter((r) => r.name);
        setRows(normalized);
      },
      error: (err) => setParseError(err.message),
    });
  };

  const submit = async () => {
    if (!rows.length) return;
    setBusy(true); setImportErr(null); setResult(null);
    try {
      const res = await crm<ImportResult>("clients.bulkImport", { rows });
      setResult(res);
      if (res.inserted > 0) onImported();
    } catch (e) { setImportErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const activeCount = rows.filter((r) => r.status === "active").length;
  const prospectCount = rows.length - activeCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-[#0A1120] border border-white/10 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.6)] m-4 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-[#EEF1FA]">Bulk Import Clients</h2>
            <p className="text-xs text-[rgba(238,241,250,0.55)]">Upload a CSV/TSV exported from your previous CRM. We auto-detect columns.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-[rgba(238,241,250,0.5)] hover:bg-white/10 hover:text-[#EEF1FA]"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* File picker */}
          {!rows.length && !result && (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFileChange(f);
              }}
              className="cursor-pointer rounded-xl border-2 border-dashed border-white/15 hover:border-[#0078D7]/60 hover:bg-white/3 transition-colors py-12 flex flex-col items-center justify-center text-center"
            >
              <Upload className="w-8 h-8 text-[rgba(238,241,250,0.4)] mb-3" />
              <p className="text-sm font-semibold text-[#EEF1FA]">Drop your CSV or TSV here</p>
              <p className="text-xs text-[rgba(238,241,250,0.55)] mt-1">or click to browse</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChange(f); }}
              />
            </div>
          )}

          {parseError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Could not parse file</div>
                  <div className="text-xs mt-1 text-red-200/80">{parseError}</div>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !result && (
            <>
              <div className="flex items-center justify-between bg-[#111E33] border border-white/10 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-[#0078D7]" />
                  <span className="font-semibold text-[#EEF1FA]">{fileName}</span>
                </div>
                <button onClick={() => { setRows([]); setFileName(null); }} className="text-xs text-[rgba(238,241,250,0.55)] hover:text-[#EEF1FA]">Choose another</button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Stat label="Total rows" value={rows.length} />
                <Stat label="Active (with services)" value={activeCount} accent="success" />
                <Stat label="Prospects (no services)" value={prospectCount} accent="warning" />
              </div>

              <div className="rounded-lg border border-white/10 overflow-hidden">
                <div className="px-4 py-2 bg-white/3 text-[10px] font-bold uppercase tracking-wider text-[rgba(238,241,250,0.55)]">Preview (first 10)</div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <Th>Name</Th>
                      <Th>City</Th>
                      <Th>Phone</Th>
                      <Th>GBP ID</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="px-3 py-2 text-xs text-[#EEF1FA] truncate max-w-[200px]">{r.name}</td>
                        <td className="px-3 py-2 text-xs text-[rgba(238,241,250,0.7)]">{r.city ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-[rgba(238,241,250,0.7)]">{r.phone ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-[rgba(238,241,250,0.55)] font-mono">{r.gbp_connection_id ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${r.status === "active" ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-[#F97316]/15 text-[#F97316]"}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[rgba(238,241,250,0.55)]">
                Tip: rows whose <span className="font-mono text-[#EEF1FA]">AccountIdentifier</span> already exists in your database will be skipped.
              </p>
            </>
          )}

          {importErr && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{importErr}</span>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3 text-sm text-[#86EFAC] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Import complete</div>
                  <div className="text-xs mt-1 text-[#BBF7D0]/80">
                    {result.inserted} inserted · {result.skipped} skipped (duplicates) · {result.error_count} errors · {result.total} total
                  </div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-[#111E33] px-4 py-3 max-h-40 overflow-auto">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[rgba(238,241,250,0.55)] mb-2">First {result.errors.length} errors</div>
                  <ul className="space-y-1 text-xs text-red-300/80">
                    {result.errors.map((e, i) => (
                      <li key={i}>Row {e.index + 1}{e.name ? ` (${e.name})` : ""}: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-[rgba(238,241,250,0.7)] hover:text-[#EEF1FA]">
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={submit}
              disabled={!rows.length || busy}
              className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…</> : <><Upload className="w-3.5 h-3.5" /> Import {rows.length} client{rows.length === 1 ? "" : "s"}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[rgba(238,241,250,0.55)]">{children}</th>;
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "success" | "warning" }) {
  const color = accent === "success" ? "text-[#22C55E]" : accent === "warning" ? "text-[#F97316]" : "text-[#EEF1FA]";
  return (
    <div className="bg-[#111E33] border border-white/10 rounded-lg px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[rgba(238,241,250,0.55)]">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}
