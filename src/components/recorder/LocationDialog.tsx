import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ErrorNote } from "./RecorderBits";
import { recorder, uploadRecorderAsset, type RecorderLocation } from "@/lib/recorder";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  location: RecorderLocation | null;
  onSaved: () => Promise<void> | void;
}

interface FormState {
  name: string;
  address: string;
  neighbourhood: string;
  website: string;
  phone: string;
  logo_url: string;
  brand_color: string;
  headline: string;
  enable_video: boolean;
  enable_photos: boolean;
  enable_wall: boolean;
}

const EMPTY: FormState = {
  name: "",
  address: "",
  neighbourhood: "",
  website: "",
  phone: "",
  logo_url: "",
  brand_color: "",
  headline: "",
  enable_video: true,
  enable_photos: true,
  enable_wall: true,
};

export function LocationDialog({ open, onOpenChange, companyId, location, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(location ? {
      name: location.name ?? "",
      address: location.address ?? "",
      neighbourhood: location.neighbourhood ?? "",
      website: location.website ?? "",
      phone: location.phone ?? "",
      logo_url: location.logo_url ?? "",
      brand_color: location.brand_color ?? "",
      headline: location.headline ?? "",
      enable_video: location.enable_video,
      enable_photos: location.enable_photos,
      enable_wall: location.enable_wall,
    } : EMPTY);
  }, [open, location]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadRecorderAsset(
        { company_id: companyId, location_id: location?.id ?? null, kind: "logo", filename: file.name },
        file,
      );
      set("logo_url", url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError("Location name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recorder("location.save", {
        ...(location ? { id: location.id } : { company_id: companyId }),
        name: form.name.trim(),
        address: form.address.trim() || null,
        neighbourhood: form.neighbourhood.trim() || null,
        website: form.website.trim() || null,
        phone: form.phone.trim() || null,
        logo_url: form.logo_url.trim() || null,
        brand_color: form.brand_color.trim() || null,
        headline: form.headline.trim() || null,
        enable_video: form.enable_video,
        enable_photos: form.enable_photos,
        enable_wall: form.enable_wall,
      });
      await onSaved();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{location ? "Edit location" : "Add a location"}</DialogTitle>
          <DialogDescription>
            Each location is sent as its own company request and keeps its own logo, colour and campaigns.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="loc-name">Location name</Label>
            <Input id="loc-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Restaurant name customers see" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc-address">Address</Label>
            <Input id="loc-address" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc-neighbourhood">Neighbourhood</Label>
            <Input id="loc-neighbourhood" value={form.neighbourhood} onChange={(e) => set("neighbourhood", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc-website">Website</Label>
            <Input id="loc-website" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc-phone">Phone</Label>
            <Input id="loc-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc-colour">Brand colour</Label>
            <div className="flex gap-2">
              <input
                aria-label="Location brand colour picker"
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(form.brand_color) ? form.brand_color : "#0078D7"}
                onChange={(e) => set("brand_color", e.target.value.toUpperCase())}
                className="h-10 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1"
              />
              <Input id="loc-colour" value={form.brand_color} onChange={(e) => set("brand_color", e.target.value)} placeholder="#0078D7" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc-headline">Headline (optional)</Label>
            <Input id="loc-headline" value={form.headline} onChange={(e) => set("headline", e.target.value)} />
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="loc-logo">Location logo</Label>
            <div className="flex gap-2">
              <Input id="loc-logo" value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://… public image" />
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">The restaurant's own logo, separate from the network logo. Must be publicly readable.</p>
          </div>

          <div className="sm:col-span-2 grid gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-3">
            {([
              ["enable_video", "Video", "Customers can record video."],
              ["enable_photos", "Photos", "Customers can submit stills."],
              ["enable_wall", "Wall", "Approved content can appear on the wall."],
            ] as const).map(([key, label, description]) => (
              <div key={key} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] leading-snug text-muted-foreground">{description}</p>
                </div>
                <Switch checked={form[key]} onCheckedChange={(value) => set(key, value)} aria-label={label} />
              </div>
            ))}
          </div>
        </div>

        <ErrorNote message={error} />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {location ? "Save location" : "Add location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
