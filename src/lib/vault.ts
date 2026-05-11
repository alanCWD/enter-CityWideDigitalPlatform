import { crm } from "./crm";

export type Visibility = "agency_only" | "client_visible";

export interface VaultNote {
  id: string;
  client_id: string;
  agency_id: string;
  title: string;
  body: string | null;
  visibility: Visibility;
  pinned: 0 | 1;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaultCredential {
  id: string;
  client_id: string;
  agency_id: string;
  label: string;
  category: string | null;
  url: string | null;
  username: string | null;
  password: string | null;
  mfa_notes: string | null;
  notes: string | null;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

export interface VaultFile {
  id: string;
  client_id: string;
  agency_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string | null;
  visibility: Visibility;
  created_at: string;
}

export interface VaultBundle {
  notes: VaultNote[];
  credentials: VaultCredential[];
  files: VaultFile[];
}

// ── Notes ────────────────────────────────────────────────
export const upsertNote = (input: Partial<VaultNote> & { client_id: string; title: string }) =>
  crm<{ id: string }>("vault.notes.upsert", input);
export const deleteNote = (id: string) => crm<{ ok: true }>("vault.notes.delete", { id });

// ── Credentials ──────────────────────────────────────────
export const upsertCredential = (input: Partial<VaultCredential> & { client_id: string; label: string }) =>
  crm<{ id: string }>("vault.creds.upsert", input);
export const deleteCredential = (id: string) => crm<{ ok: true }>("vault.creds.delete", { id });

// ── Files ────────────────────────────────────────────────
export interface UploadUrlResponse {
  upload_url: string;
  token: string;
  storage_path: string;
  file_id: string;
}

export const requestUploadUrl = (input: { client_id: string; filename: string; mime_type: string }) =>
  crm<UploadUrlResponse>("vault.files.uploadUrl", input);

export const confirmUpload = (input: { client_id: string; file_id: string; storage_path: string; filename: string; mime_type: string; size_bytes: number; kind: string; visibility: Visibility }) =>
  crm<{ id: string }>("vault.files.confirm", input);

export const downloadFileUrl = (id: string) =>
  crm<{ url: string; filename: string; mime_type: string | null }>("vault.files.download", { id });

export const deleteFile = (id: string) => crm<{ ok: true }>("vault.files.delete", { id });

export const updateFile = (input: { id: string; visibility: Visibility; kind?: string }) =>
  crm<{ ok: true }>("vault.files.update", input);

/** Direct PUT to the signed upload URL with the file body. */
export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${txt.slice(0, 200)}`);
  }
}
