import { useState } from "react";
import { Pin, Pencil, Trash2, Plus, Eye, Lock, Loader2 } from "lucide-react";
import type { VaultNote, Visibility } from "@/lib/vault";
import { upsertNote, deleteNote } from "@/lib/vault";

interface Props {
  clientId: string;
  notes: VaultNote[];
  onChange: () => void;
}

export function NotesSection({ clientId, notes, onChange }: Props) {
  const [editing, setEditing] = useState<VaultNote | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section className="bg-[#0D1526] border border-border dark:border-white/10 rounded-2xl">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-white/10">
        <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">Notes</h3>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0078D7] hover:text-[#3FA9FF]">
          <Plus className="w-3.5 h-3.5" /> Add note
        </button>
      </div>
      <div className="p-5 space-y-3">
        {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet. Add the first one to keep internal context here.</p>}
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} onEdit={() => setEditing(n)} onDelete={async () => { if (confirm(`Delete note "${n.title}"?`)) { await deleteNote(n.id); onChange(); } }} />
        ))}
      </div>

      {(adding || editing) && (
        <NoteEditor
          clientId={clientId}
          note={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); onChange(); }}
        />
      )}
    </section>
  );
}

function NoteCard({ note, onEdit, onDelete }: { note: VaultNote; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-lg px-4 py-3 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {note.pinned ? <Pin className="w-3.5 h-3.5 text-[#F97316] fill-[#F97316]" /> : null}
            <h4 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] truncate">{note.title}</h4>
            <VisibilityBadge v={note.visibility} />
          </div>
          {note.body && <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap line-clamp-6">{note.body}</p>}
          <p className="text-[10px] text-muted-foreground mt-2">Updated {new Date(note.updated_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <IconBtn onClick={onEdit} title="Edit"><Pencil className="w-3.5 h-3.5" /></IconBtn>
          <IconBtn onClick={onDelete} title="Delete" danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>
        </div>
      </div>
    </div>
  );
}

export function VisibilityBadge({ v }: { v: Visibility }) {
  if (v === "client_visible") return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#22C55E]/15 text-[#22C55E]"><Eye className="w-3 h-3" /> Shared</span>;
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-muted/60 dark:bg-white/5 text-muted-foreground"><Lock className="w-3 h-3" /> Internal</span>;
}

export function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} className={`p-1.5 rounded-md hover:bg-muted dark:bg-white/10 transition-colors ${danger ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-foreground dark:text-[#EEF1FA]"}`}>
      {children}
    </button>
  );
}

function NoteEditor({ clientId, note, onClose, onSaved }: { clientId: string; note: VaultNote | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [visibility, setVisibility] = useState<Visibility>(note?.visibility ?? "agency_only");
  const [pinned, setPinned] = useState<boolean>(!!note?.pinned);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) { setErr("Title is required"); return; }
    setBusy(true); setErr(null);
    try {
      await upsertNote({ id: note?.id, client_id: clientId, title: title.trim(), body, visibility, pinned: pinned ? 1 : 0 });
      onSaved();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-[#0A1120] border border-border dark:border-white/10 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.6)] m-4">
        <div className="px-5 py-3 border-b border-border dark:border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">{note ? "Edit note" : "New note"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground dark:text-[#EEF1FA] text-xs">Cancel</button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
          </Field>
          <Field label="Body (markdown supported)">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="input font-mono text-xs" />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <Field label="Visibility">
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className="input">
                <option value="agency_only">Internal — agency only</option>
                <option value="client_visible">Shared — visible in client portal</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-xs text-muted-foreground mt-5 whitespace-nowrap">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Pin to top
            </label>
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        <div className="px-5 py-3 border-t border-border dark:border-white/10 flex justify-end">
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg">
            {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : "Save note"}
          </button>
        </div>
      </div>
      <style>{`.input { width:100%; background:#111E33; border:1px solid rgba(255,255,255,0.1); color:#EEF1FA; padding:0.5rem 0.75rem; border-radius:0.5rem; font-size:0.875rem; outline:none; } .input:focus { border-color:#0078D7; }`}</style>
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
