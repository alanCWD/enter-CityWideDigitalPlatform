// Brand-asset RPC wrappers (mirrors the vault.files.* pattern in vault.ts),
// scoped to the public brand-assets bucket + the client_brand_assets table.
import { crm } from "./crm";

export interface ClientBrandAssets {
  crm_client_id: string;
  logo_square_url: string | null;
  logo_rect_url: string | null;
  logo_square_dark_url: string | null;
  logo_rect_dark_url: string | null;
  tagline: string | null;
  updated_at: string;
}

export type BrandSlot =
  | "logo_square_url"
  | "logo_rect_url"
  | "logo_square_dark_url"
  | "logo_rect_dark_url";

export interface BrandUploadUrlResponse {
  upload_url: string;
  token: string;
  storage_path: string;
  public_url: string;
}

export interface BrandSaveInput {
  client_id: string;
  logo_square_url?: string | null;
  logo_rect_url?: string | null;
  logo_square_dark_url?: string | null;
  logo_rect_dark_url?: string | null;
  tagline?: string | null;
}

/** Load the brand-asset row for a client (or null if none set yet). */
export const getBrand = (client_id: string) =>
  crm<{ assets: ClientBrandAssets | null }>("brand.get", { client_id });

/** Request a signed upload URL for one brand-asset slot in the public bucket. */
export const requestBrandUploadUrl = (input: {
  client_id: string;
  slot: BrandSlot;
  filename: string;
  mime_type: string;
}) => crm<BrandUploadUrlResponse>("brand.uploadUrl", input);

/** Persist the public URLs / tagline onto the client_brand_assets row. */
export const saveBrand = (input: BrandSaveInput) =>
  crm<{ ok: true }>("brand.save", input);

/** Build a single-slot update payload in a type-safe way (avoids computed-key widening). */
export function brandSlotUpdate(client_id: string, slot: BrandSlot, value: string | null): BrandSaveInput {
  const u: BrandSaveInput = { client_id };
  switch (slot) {
    case "logo_square_url": u.logo_square_url = value; break;
    case "logo_rect_url": u.logo_rect_url = value; break;
    case "logo_square_dark_url": u.logo_square_dark_url = value; break;
    case "logo_rect_dark_url": u.logo_rect_dark_url = value; break;
  }
  return u;
}

/** Direct PUT to the signed upload URL with the file body. */
export async function uploadBrandToSignedUrl(uploadUrl: string, file: File): Promise<void> {
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
