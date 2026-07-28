import { useEffect, useState } from "react";
import { Upload, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import {
  requestBrandUploadUrl,
  uploadBrandToSignedUrl,
  saveBrand,
  brandSlotUpdate,
  type BrandSlot,
  type ClientBrandAssets,
} from "@/lib/brand";

const SLOTS: { key: BrandSlot; label: string; hint: string }[] = [
  { key: "logo_rect_url", label: "Rectangle — light", hint: "Shown in the review email header" },
  { key: "logo_rect_dark_url", label: "Rectangle — dark", hint: "For dark email backgrounds" },
  { key: "logo_square_url", label: "Square — light", hint: "Avatar / profile style" },
  { key: "logo_square_dark_url", label: "Square — dark", hint: "For dark backgrounds" },
];

interface Props {
  clientId: string;
  assets: ClientBrandAssets | null;
  onSaved: () => void;
}

export function BrandAssetsUploader({ clientId, assets, onSaved }: Props) {
  const [busy, setBusy] = useState<BrandSlot | "tagline" | null>(null);
  const [tagline, setTagline] = useState(assets?.tagline || "");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTagline(assets?.tagline || "");
  }, [assets?.tagline]);

  async function uploadSlot(slot: BrandSlot, file: File) {
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file (PNG, JPG, SVG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image must be under 5MB.");
      return;
    }
    setErr(null);
    setBusy(slot);
    try {
      const { upload_url, public_url } = await requestBrandUploadUrl({
        client_id: clientId,
        slot,
        filename: file.name,
        mime_type: file.type,
      });
      await uploadBrandToSignedUrl(upload_url, file);
      await saveBrand(brandSlotUpdate(clientId, slot, public_url));
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function removeSlot(slot: BrandSlot) {
    setErr(null);
    setBusy(slot);
    try {
      await saveBrand(brandSlotUpdate(clientId, slot, null));
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveTagline() {
    setErr(null);
    setBusy("tagline");
    try {
      await saveBrand({ client_id: clientId, tagline: tagline.trim() || null });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SLOTS.map((slot) => {
          const url = (assets?.[slot.key] as string | null) || null;
          const isBusy = busy === slot.key;
          return (
            <div key={slot.key} className="rounded-lg border border-border dark:border-white/10 p-3 bg-muted/20">
              <div className="flex items-start justify-between mb-2 gap-2">
                <div>
                  <p className="text-xs font-bold text-foreground dark:text-[#EEF1FA]">{slot.label}</p>
                  <p className="text-[10px] text-muted-foreground">{slot.hint}</p>
                </div>
                {url && (
                  <button
                    onClick={() => removeSlot(slot.key)}
                    disabled={isBusy}
                    className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="aspect-[3/2] bg-background dark:bg-[#0D1526] rounded-md flex items-center justify-center overflow-hidden border border-border dark:border-white/10">
                {url ? (
                  <img src={url} alt={slot.label} className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                )}
              </div>
          <label className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-[#0078D7] hover:text-[#005FA3] cursor-pointer border border-dashed border-border dark:border-white/15 rounded-md py-1.5 transition-colors">
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {url ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadSlot(slot.key, f);
                      e.target.value = "";
                    }}
                  />
                </label>
            </div>
          );
        })}
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
          Tagline (optional)
        </label>
        <textarea
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          rows={2}
          placeholder="e.g. Trusted local plumbers since 1998"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7] resize-none"
        />
        <div className="flex justify-end mt-1.5">
          <button
            onClick={saveTagline}
            disabled={busy === "tagline"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0078D7] hover:bg-[#005FA3] disabled:opacity-50 text-white transition-colors"
          >
            {busy === "tagline" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Save Tagline
          </button>
        </div>
      </div>

      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
