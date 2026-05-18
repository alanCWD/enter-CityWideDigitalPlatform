import { useState } from "react";
import { Pencil, Trash2, Plus, Eye, EyeOff, Copy, ExternalLink, Loader2, KeyRound } from "lucide-react";
import type { VaultCredential, Visibility } from "@/lib/vault";
import { upsertCredential, deleteCredential } from "@/lib/vault";
import { VisibilityBadge, IconBtn } from "./NotesSection";

interface Props {
  clientId: string;
  credentials: VaultCredential[];
  onChange: () => void;
}

export function CredentialsSection({ clientId, credentials, onChange }: Props) {
  const [editing, setEditing] = useState<VaultCredential | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section className="bg-[#0D1526] border border-border dark:border-white/10 rounded-2xl">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-white/10">
        <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] flex items-center gap-2"><KeyRound className="w-4 h-4 text-[#F97316]" /> Credentials & Logins</h3>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0078D7] hover:text-[#3FA9FF]">
          <Plus className="w-3.5 h-3.5" /> Add credential
        </button>
      </div>
      <div className="p-5 space-y-3">
        {credentials.length === 0 && <p className="text-xs text-muted-foreground">No saved credentials. Use this to keep GBP, hosting, social, ads logins for the team.</p>}
        {credentials.map((c) => (
          <CredentialCard key={c.id} cred={c} onEdit={() => setEditing(c)} onDelete={async () => { if (confirm(`Delete "${c.label}"?`)) { await deleteCredential(c.id); onChange(); } }} />
        ))}
      </div>

      {(adding || editing) && (
        <CredentialEditor
          clientId={clientId}
          cred={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); onChange(); }}
        />
      )}
    </section>
  );
}

function CredentialCard({ cred, onEdit, onDelete }: { cred: VaultCredential; onEdit: () => void; onDelete: () => void }) {
  const [reveal, setReveal] = useState(false);
  const copy = (val: string | null) => { if (val) { navigator.clipboard.writeText(val); } };

  return (
    <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-lg px-4 py-3 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">{cred.label}</h4>
            {cred.category && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 dark:bg-white/5 text-muted-foreground">{cred.category}</span>}
            <VisibilityBadge v={cred.visibility} />
          </div>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {cred.url && (
              <Row label="URL">
                <a href={cred.url} target="_blank" rel="noreferrer" className="text-[#3FA9FF] hover:underline truncate inline-flex items-center gap-1">
                  {cred.url} <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </Row>
            )}
            {cred.username && (
              <Row label="Username">
                <span className="text-foreground dark:text-[#EEF1FA] flex items-center gap-1.5"><span className="truncate">{cred.username}</span><CopyBtn onClick={() => copy(cred.username)} /></span>
              </Row>
            )}
            {cred.password && (
              <Row label="Password">
                <span className="text-foreground dark:text-[#EEF1FA] flex items-center gap-1.5">
                  <span className="font-mono truncate">{reveal ? cred.password : "••••••••••"}</span>
                  <button onClick={() => setReveal((r) => !r)} className="text-muted-foreground hover:text-foreground dark:text-[#EEF1FA]">
                    {reveal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  <CopyBtn onClick={() => copy(cred.password)} />
                </span>
              </Row>
            )}
            {cred.mfa_notes && <Row label="MFA"><span className="text-[#F97316] text-[11px]">{cred.mfa_notes}</span></Row>}
          </div>
          {cred.notes && <p className="text-[11px] text-muted-foreground mt-2 whitespace-pre-wrap">{cred.notes}</p>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <IconBtn onClick={onEdit} title="Edit"><Pencil className="w-3.5 h-3.5" /></IconBtn>
          <IconBtn onClick={onDelete} title="Delete" danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function CopyBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} title="Copy" className="text-muted-foreground hover:text-foreground dark:text-[#EEF1FA]"><Copy className="w-3 h-3" /></button>;
}

const CATEGORIES = ["Google Business Profile", "Google Ads", "Facebook / Meta", "Instagram", "Hosting", "Domain Registrar", "Email", "WordPress", "Social", "Analytics", "Other"];

function CredentialEditor({ clientId, cred, onClose, onSaved }: { clientId: string; cred: VaultCredential | null; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(cred?.label ?? "");
  const [category, setCategory] = useState(cred?.category ?? "");
  const [url, setUrl] = useState(cred?.url ?? "");
  const [username, setUsername] = useState(cred?.username ?? "");
  const [password, setPassword] = useState(cred?.password ?? "");
  const [mfaNotes, setMfaNotes] = useState(cred?.mfa_notes ?? "");
  const [notes, setNotes] = useState(cred?.notes ?? "");
  const [visibility, setVisibility] = useState<Visibility>(cred?.visibility ?? "agency_only");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!label.trim()) { setErr("Label is required"); return; }
    setBusy(true); setErr(null);
    try {
      await upsertCredential({ id: cred?.id, client_id: clientId, label: label.trim(), category, url, username, password, mfa_notes: mfaNotes, notes, visibility });
      onSaved();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-[#0A1120] border border-border dark:border-white/10 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.6)] m-4 max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-border dark:border-white/10 flex items-center justify-between sticky top-0 bg-[#0A1120] z-10">
          <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">{cred ? "Edit credential" : "New credential"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground dark:text-[#EEF1FA] text-xs">Cancel</button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Label *">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. WordPress Admin" className="vault-input" />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="vault-input">
              <option value="">—</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className="vault-input" /></Field>
          <Field label="Visibility">
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className="vault-input">
              <option value="agency_only">Internal — agency only</option>
              <option value="client_visible">Shared — visible in client portal</option>
            </select>
          </Field>
          <Field label="Username"><input value={username} onChange={(e) => setUsername(e.target.value)} className="vault-input" /></Field>
          <Field label="Password"><input value={password} onChange={(e) => setPassword(e.target.value)} className="vault-input font-mono" /></Field>
          <div className="sm:col-span-2"><Field label="MFA / 2FA notes"><input value={mfaNotes} onChange={(e) => setMfaNotes(e.target.value)} placeholder="Backup codes, authenticator app, etc." className="vault-input" /></Field></div>
          <div className="sm:col-span-2"><Field label="Additional notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="vault-input" /></Field></div>
          {err && <p className="sm:col-span-2 text-xs text-red-400">{err}</p>}
        </div>
        <div className="px-5 py-3 border-t border-border dark:border-white/10 flex justify-end sticky bottom-0 bg-[#0A1120]">
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg">
            {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : "Save credential"}
          </button>
        </div>
      </div>
      <style>{`.vault-input { width:100%; background:#111E33; border:1px solid rgba(255,255,255,0.1); color:#EEF1FA; padding:0.5rem 0.75rem; border-radius:0.5rem; font-size:0.875rem; outline:none; } .vault-input:focus { border-color:#0078D7; }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
