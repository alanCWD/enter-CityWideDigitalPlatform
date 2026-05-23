import { useRef, useState } from "react";
import { Upload, Trash2, Download, FileText, Image as ImageIcon, FileArchive, Loader2, Eye } from "lucide-react";
import type { VaultFile, Visibility } from "@/lib/vault";
import { requestUploadUrl, uploadToSignedUrl, confirmUpload, deleteFile, downloadFileUrl, updateFile } from "@/lib/vault";
import { VisibilityBadge, IconBtn } from "./NotesSection";

interface Props {
  clientId: string;
  files: VaultFile[];
  onChange: () => void;
}

const KIND_OPTIONS = [
  { value: "logo", label: "Logo" },
  { value: "contract", label: "Contract" },
  { value: "brand", label: "Brand asset" },
  { value: "photo", label: "Photo" },
  { value: "doc", label: "Document" },
  { value: "other", label: "Other" },
];

function inferKind(file: File): string {
  const n = file.name.toLowerCase();
  if (file.type.startsWith("image/")) {
    if (/logo/.test(n)) return "logo";
    if (/brand|guideline/.test(n)) return "brand";
    return "photo";
  }
  if (/contract|agreement|invoice/.test(n)) return "contract";
  if (file.type === "application/pdf") return "doc";
  return "other";
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string | null }) {
  if (mime?.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-[#3FA9FF]" />;
  if (mime === "application/pdf" || mime?.includes("document") || mime?.includes("text")) return <FileText className="w-4 h-4 text-[#22C55E]" />;
  if (mime?.includes("zip") || mime?.includes("archive")) return <FileArchive className="w-4 h-4 text-[#F97316]" />;
  return <FileText className="w-4 h-4 text-muted-foreground" />;
}

export function FilesSection({ clientId, files, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [defaultVisibility, setDefaultVisibility] = useState<Visibility>("agency_only");
  const [err, setErr] = useState<string | null>(null);

  async function uploadAll(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    setErr(null);
    setProgress({ current: 0, total: arr.length });
    try {
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i];
        setUploading(f.name); setProgress({ current: i, total: arr.length });
        const mime = f.type || "application/octet-stream";
        const { upload_url, storage_path, file_id } = await requestUploadUrl({ client_id: clientId, filename: f.name, mime_type: mime });
        await uploadToSignedUrl(upload_url, f);
        await confirmUpload({ client_id: clientId, file_id, storage_path, filename: f.name, mime_type: mime, size_bytes: f.size, kind: inferKind(f), visibility: defaultVisibility });
      }
      setProgress({ current: arr.length, total: arr.length });
      onChange();
    } catch (e) { setErr((e as Error).message); }
    finally { setUploading(null); setTimeout(() => setProgress(null), 800); }
  }

  return (
    <section className="bg-card dark:bg-[#0D1526] border border-border dark:border-white/10 rounded-2xl">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-white/10 gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">Files</h3>
        <div className="flex items-center gap-2">
          <select value={defaultVisibility} onChange={(e) => setDefaultVisibility(e.target.value as Visibility)} className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 text-foreground dark:text-[#EEF1FA] text-[11px] rounded px-2 py-1">
            <option value="agency_only">New uploads: Internal</option>
            <option value="client_visible">New uploads: Shared with client</option>
          </select>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0078D7] hover:bg-[#00447A] px-3 py-1.5 rounded-md">
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) uploadAll(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadAll(e.dataTransfer.files); }}
        className={`m-5 mb-0 border-2 border-dashed rounded-xl px-5 py-6 text-center transition-colors ${dragOver ? "border-[#0078D7] bg-[#0078D7]/10" : "border-border dark:border-white/10 bg-card dark:bg-[#111E33]/40"}`}
      >
        <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">
          Drop logos, contracts, photos here or <button onClick={() => fileRef.current?.click()} className="text-[#3FA9FF] hover:underline font-semibold">browse</button>
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">Stored privately. Files marked &ldquo;Shared&rdquo; are visible in the client portal.</p>
      </div>

      {progress && (
        <div className="mx-5 mt-3 text-xs text-muted-foreground flex items-center gap-2">
          {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0078D7]" />}
          <span>Uploading {progress.current + (uploading ? 1 : 0)} / {progress.total}{uploading ? ` — ${uploading}` : ""}</span>
        </div>
      )}
      {err && <p className="mx-5 mt-2 text-xs text-red-400">{err}</p>}

      <div className="p-5 space-y-2">
        {files.length === 0 && <p className="text-xs text-muted-foreground">No files yet.</p>}
        {files.map((f) => <FileRow key={f.id} file={f} onChange={onChange} />)}
      </div>
    </section>
  );
}

function FileRow({ file, onChange }: { file: VaultFile; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try { const { url } = await downloadFileUrl(file.id); window.open(url, "_blank", "noreferrer"); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm(`Delete "${file.filename}"?`)) return;
    setBusy(true);
    try { await deleteFile(file.id); onChange(); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  const toggleVis = async () => {
    setBusy(true);
    try { await updateFile({ id: file.id, visibility: file.visibility === "client_visible" ? "agency_only" : "client_visible" }); onChange(); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };
  const setKind = async (k: string) => {
    setBusy(true);
    try { await updateFile({ id: file.id, visibility: file.visibility, kind: k }); onChange(); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-3 bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-lg px-3 py-2 group">
      <FileIcon mime={file.mime_type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-foreground dark:text-[#EEF1FA] truncate font-medium">{file.filename}</span>
          <VisibilityBadge v={file.visibility} />
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
          <span>{fmtSize(file.size_bytes)}</span>
          <span>{new Date(file.created_at).toLocaleDateString()}</span>
          <select value={file.kind ?? "other"} onChange={(e) => setKind(e.target.value)} disabled={busy} className="bg-transparent border border-border dark:border-white/10 rounded px-1 py-0.5 text-[10px] text-muted-foreground">
            {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value} className="bg-card dark:bg-[#0A1120]">{k.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconBtn onClick={toggleVis} title={file.visibility === "client_visible" ? "Make internal" : "Share with client"}>
          <Eye className={`w-3.5 h-3.5 ${file.visibility === "client_visible" ? "text-[#22C55E]" : ""}`} />
        </IconBtn>
        <IconBtn onClick={open} title="Open / download"><Download className="w-3.5 h-3.5" /></IconBtn>
        <IconBtn onClick={remove} title="Delete" danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>
      </div>
    </div>
  );
}
