import { useEffect, useState } from "react";
import { Loader2, KeyRound, FileText, NotebookPen, Eye, EyeOff, Copy, Download, ExternalLink, Shield } from "lucide-react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { supabase } from "@/integrations/supabase/client";
import type { PortalConnection } from "@/hooks/usePortalConnections";

interface VaultData {
  client_name: string;
  notes: Array<{ id: string; title: string; body: string | null; pinned: 0 | 1; updated_at: string }>;
  credentials: Array<{ id: string; label: string; category: string | null; url: string | null; username: string | null; password: string | null; mfa_notes: string | null; notes: string | null; updated_at: string }>;
  files: Array<{ id: string; filename: string; mime_type: string | null; size_bytes: number | null; kind: string | null; created_at: string }>;
}

async function portalVault<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("portal-vault", { body: { action, payload } });
  if (error) throw new Error(error.message || "Network error");
  if (data && typeof data === "object" && "error" in data && data.error) throw new Error(String((data as { error: string }).error));
  return data as T;
}

function VaultContent({ connection }: { connection: PortalConnection }) {
  const [data, setData] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    portalVault<VaultData>("list", { connection_id: connection.id })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [connection.id]);

  if (loading) return <div className="flex items-center justify-center py-16 text-[rgba(238,241,250,0.6)]"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading vault…</div>;
  if (error) return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 text-sm text-amber-200">
      <p className="font-bold">Vault unavailable</p>
      <p className="text-xs mt-1 opacity-80">{error}</p>
    </div>
  );
  if (!data) return null;

  const empty = data.notes.length + data.credentials.length + data.files.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#EEF1FA] flex items-center gap-2"><Shield className="w-5 h-5 text-[#0078D7]" /> Your Vault</h1>
        <p className="text-sm text-[rgba(238,241,250,0.55)] mt-1">Documents, credentials, and notes shared with you by your agency.</p>
      </div>

      {empty && (
        <div className="bg-[#111E33] border border-white/8 rounded-xl px-5 py-8 text-center">
          <Shield className="w-8 h-8 mx-auto text-[rgba(238,241,250,0.3)] mb-3" />
          <p className="text-sm text-[rgba(238,241,250,0.6)]">Nothing has been shared with you yet.</p>
          <p className="text-xs text-[rgba(238,241,250,0.45)] mt-1">When your agency shares notes, credentials, or files, they'll appear here.</p>
        </div>
      )}

      {data.notes.length > 0 && (
        <Section icon={NotebookPen} title="Notes">
          {data.notes.map((n) => (
            <div key={n.id} className="bg-[#111E33] border border-white/8 rounded-xl p-4">
              <h4 className="text-sm font-bold text-[#EEF1FA]">{n.title}</h4>
              {n.body && <p className="text-xs text-[rgba(238,241,250,0.7)] whitespace-pre-wrap mt-2">{n.body}</p>}
              <p className="text-[10px] text-[rgba(238,241,250,0.4)] mt-2">{new Date(n.updated_at).toLocaleString()}</p>
            </div>
          ))}
        </Section>
      )}

      {data.credentials.length > 0 && (
        <Section icon={KeyRound} title="Credentials & Logins">
          {data.credentials.map((c) => <PortalCredentialRow key={c.id} cred={c} />)}
        </Section>
      )}

      {data.files.length > 0 && (
        <Section icon={FileText} title="Files">
          {data.files.map((f) => <PortalFileRow key={f.id} file={f} />)}
        </Section>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider text-[rgba(238,241,250,0.5)] flex items-center gap-2 mb-3"><Icon className="w-3.5 h-3.5" /> {title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PortalCredentialRow({ cred }: { cred: VaultData["credentials"][number] }) {
  const [reveal, setReveal] = useState(false);
  const copy = (val: string | null) => { if (val) navigator.clipboard.writeText(val); };
  return (
    <div className="bg-[#111E33] border border-white/8 rounded-xl p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="text-sm font-bold text-[#EEF1FA]">{cred.label}</h4>
        {cred.category && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-[rgba(238,241,250,0.6)]">{cred.category}</span>}
      </div>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {cred.url && <Row label="URL"><a href={cred.url} target="_blank" rel="noreferrer" className="text-[#3FA9FF] hover:underline truncate inline-flex items-center gap-1">{cred.url} <ExternalLink className="w-3 h-3 shrink-0" /></a></Row>}
        {cred.username && <Row label="Username"><span className="text-[#EEF1FA] flex items-center gap-1.5"><span className="truncate">{cred.username}</span><button onClick={() => copy(cred.username)} className="text-[rgba(238,241,250,0.5)] hover:text-[#EEF1FA]"><Copy className="w-3 h-3" /></button></span></Row>}
        {cred.password && <Row label="Password"><span className="text-[#EEF1FA] flex items-center gap-1.5"><span className="font-mono truncate">{reveal ? cred.password : "••••••••••"}</span><button onClick={() => setReveal((r) => !r)} className="text-[rgba(238,241,250,0.55)] hover:text-[#EEF1FA]">{reveal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button><button onClick={() => copy(cred.password)} className="text-[rgba(238,241,250,0.5)] hover:text-[#EEF1FA]"><Copy className="w-3 h-3" /></button></span></Row>}
        {cred.mfa_notes && <Row label="MFA"><span className="text-[#F97316] text-[11px]">{cred.mfa_notes}</span></Row>}
      </div>
      {cred.notes && <p className="text-[11px] text-[rgba(238,241,250,0.65)] mt-2 whitespace-pre-wrap">{cred.notes}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-[rgba(238,241,250,0.45)] w-16 shrink-0">{label}</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function PortalFileRow({ file }: { file: VaultData["files"][number] }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try { const { url } = await portalVault<{ url: string }>("download", { file_id: file.id }); window.open(url, "_blank", "noreferrer"); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="bg-[#111E33] border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
      <FileText className="w-4 h-4 text-[#3FA9FF] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#EEF1FA] font-medium truncate">{file.filename}</p>
        <p className="text-[10px] text-[rgba(238,241,250,0.4)]">{file.kind ?? "file"} · {fmtSize(file.size_bytes)} · {new Date(file.created_at).toLocaleDateString()}</p>
      </div>
      <button onClick={open} disabled={busy} className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#00447A] text-white text-xs font-bold px-3 py-1.5 rounded-md disabled:opacity-50">
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
        Open
      </button>
    </div>
  );
}

function fmtSize(b: number | null) { if (!b) return "—"; if (b < 1024) return `${b} B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`; return `${(b / 1024 / 1024).toFixed(1)} MB`; }

export default function PortalVault() {
  return <PortalLayout>{(c) => <VaultContent connection={c} />}</PortalLayout>;
}
