import { useEffect, useState } from "react";
import { Loader2, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "./RecorderBits";
import {
  recorder,
  REVIEW_SCENES,
  VFS_PROMO_SCENES,
  type CampaignFormat,
  type RecorderCampaign,
  type SceneCapture,
} from "@/lib/recorder";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  campaign: RecorderCampaign | null;
  onSaved: () => Promise<void> | void;
}

interface SceneForm {
  key: string;
  label: string;
  prompt: string;
  hint: string;
  capture: SceneCapture;
}

interface FormState {
  label: string;
  headline: string;
  format: CampaignFormat;
  due_at: string;
  dish_name: string;
  concept: string;
  enable_video: boolean;
  enable_photos: boolean;
  active: boolean;
  scenes: SceneForm[];
}

const fromTemplate = (scenes: Array<Omit<SceneForm, "hint"> & { hint?: string }>): SceneForm[] =>
  scenes.map((s) => ({ key: s.key, label: s.label, prompt: s.prompt, hint: s.hint ?? "", capture: s.capture }));

const NEW_REVIEW: FormState = {
  label: "Customer review",
  headline: "",
  format: "review",
  due_at: "",
  dish_name: "",
  concept: "",
  enable_video: true,
  enable_photos: true,
  active: true,
  scenes: fromTemplate(REVIEW_SCENES),
};

const NEW_PROMO: FormState = {
  label: "Victoria Food Scene promo",
  headline: "",
  format: "promo",
  due_at: "",
  dish_name: "",
  concept: "",
  enable_video: true,
  enable_photos: false,
  active: true,
  scenes: fromTemplate(VFS_PROMO_SCENES),
};

export function CampaignDialog({ open, onOpenChange, locationId, campaign, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(NEW_REVIEW);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!campaign) {
      setForm(NEW_REVIEW);
      return;
    }
    const scenes = [...(campaign.scenes ?? [])].sort((a, b) => a.position - b.position);
    setForm({
      label: campaign.label ?? "",
      headline: campaign.headline ?? "",
      format: campaign.format,
      due_at: campaign.due_at ? campaign.due_at.slice(0, 10) : "",
      dish_name: campaign.dish_name ?? "",
      concept: campaign.concept ?? "",
      enable_video: campaign.enable_video,
      enable_photos: campaign.enable_photos,
      active: campaign.active,
      scenes: scenes.length === 3
        ? scenes.map((s) => ({ key: s.key, label: s.label, prompt: s.prompt, hint: s.hint ?? "", capture: s.capture }))
        : fromTemplate(campaign.format === "promo" ? VFS_PROMO_SCENES : REVIEW_SCENES),
    });
  }, [open, campaign]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const chooseTemplate = (kind: "review" | "promo") => {
    setForm(kind === "promo" ? NEW_PROMO : NEW_REVIEW);
  };

  const setScene = (index: number, patch: Partial<SceneForm>) => {
    setForm((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene, i) => (i === index ? { ...scene, ...patch } : scene)),
    }));
  };

  const save = async () => {
    if (!form.label.trim()) {
      setError("Campaign label is required.");
      return;
    }
    if (form.format === "promo" && (!form.dish_name.trim() || !form.concept.trim())) {
      setError("A promo campaign needs a dish name and a concept.");
      return;
    }
    if (form.scenes.some((s) => !s.label.trim() || !s.prompt.trim())) {
      setError("All three scenes need a label and a prompt.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recorder("campaign.save", {
        ...(campaign ? { id: campaign.id } : {}),
        location_id: locationId,
        label: form.label.trim(),
        headline: form.headline.trim() || null,
        format: form.format,
        due_at: form.due_at || null,
        dish_name: form.dish_name.trim() || null,
        concept: form.concept.trim() || null,
        enable_video: form.format === "promo" ? true : form.enable_video,
        enable_photos: form.enable_photos,
        active: form.active,
        scenes: form.scenes.map((scene, index) => ({ ...scene, position: index + 1 })),
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
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>
            Three scenes per campaign. A promo must use video for the first two scenes and stills for the dish.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => chooseTemplate("review")}>
            <Sparkles className="h-3.5 w-3.5" /> Review template
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => chooseTemplate("promo")}>
            <Video className="h-3.5 w-3.5" /> VFS promo template
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-label">Label</Label>
            <Input id="campaign-label" value={form.label} onChange={(e) => set("label", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-format">Format</Label>
            <Select
              value={form.format}
              onValueChange={(value: CampaignFormat) => {
                setForm((prev) => ({
                  ...prev,
                  format: value,
                  enable_video: value === "promo" ? true : prev.enable_video,
                  enable_photos: value === "promo" ? false : prev.enable_photos,
                }));
              }}
            >
              <SelectTrigger id="campaign-format"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="promo">Promo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-headline">Headline</Label>
            <Input id="campaign-headline" value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="What the customer sees" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-due">Due date</Label>
            <Input id="campaign-due" type="date" value={form.due_at} onChange={(e) => set("due_at", e.target.value)} />
          </div>

          {form.format === "promo" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-dish">Dish name</Label>
                <Input id="campaign-dish" value={form.dish_name} onChange={(e) => set("dish_name", e.target.value)} placeholder="Featured dish" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="campaign-concept">Concept</Label>
                <Textarea id="campaign-concept" value={form.concept} onChange={(e) => set("concept", e.target.value)} placeholder="What is the promo about?" rows={2} />
              </div>
            </>
          )}

          <div className="sm:col-span-2 flex flex-wrap items-center gap-6 rounded-xl border border-border bg-muted/20 px-4 py-3">
            <label className="flex items-center gap-2 text-xs font-semibold">
              <Switch
                checked={form.format === "promo" ? true : form.enable_video}
                disabled={form.format === "promo"}
                onCheckedChange={(value) => set("enable_video", value)}
              />
              Video scene
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <Switch checked={form.enable_photos} onCheckedChange={(value) => set("enable_photos", value)} />
              Photo scene
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <Switch checked={form.active} onCheckedChange={(value) => set("active", value)} />
              Active
            </label>
            {form.format === "promo" && <span className="text-[10px] text-muted-foreground">Promos always enable video.</span>}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Three scenes</p>
          {form.scenes.map((scene, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-foreground">Scene {index + 1}</p>
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                  {(["video", "photos"] as const).map((capture) => (
                    <button
                      key={capture}
                      type="button"
                      onClick={() => setScene(index, { capture })}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
                        scene.capture === capture ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {capture}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Label</Label>
                  <Input value={scene.label} onChange={(e) => setScene(index, { label: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Hint</Label>
                  <Input value={scene.hint} onChange={(e) => setScene(index, { hint: e.target.value })} placeholder="Optional guidance" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Prompt</Label>
                <Textarea value={scene.prompt} onChange={(e) => setScene(index, { prompt: e.target.value })} rows={2} />
              </div>
            </div>
          ))}
        </div>

        <ErrorNote message={error} />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {campaign ? "Save campaign" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
