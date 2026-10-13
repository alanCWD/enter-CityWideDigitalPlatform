// Publishes for one client company.
//
// The engine answers per platform, so a result is never a single pass/fail: a
// two-platform post can go out on one and fail on the other. Both are reported.
//
// Media is registered before the post — the engine accepts at most one image
// (`too_many_media` for a second), and Instagram requires one. Registration
// needs the bytes and the real dimensions, so the file is encoded here.

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  createPost, isPartnerSocialError, platformLabel, registerMedia,
  type PlatformResult,
} from "@/lib/partner-social";
import { PlatformMark } from "./ChannelCard";

const CONTENT_LIMIT = 10_000;
const MAX_PLATFORMS = 5;

interface PostComposerDialogProps {
  open: boolean;
  onClose: () => void;
  businessRef: string;
  businessName: string;
  /** platforms the engine accepts here — taken from the response, never hardcoded. */
  platforms: string[];
  /** platforms with a live channel; any other selection fails per platform. */
  connectedPlatforms: string[];
  onPosted: () => void;
}

const describeFailure = (result: PlatformResult) =>
  `${platformLabel(result.platform)}${result.error ? ` — ${result.error}` : ""}`;

async function encodeImage(file: File): Promise<{ base64: string; width: number; height: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });

  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read the image dimensions."));
    img.src = dataUrl;
  });

  return { base64, ...size };
}

export function PostComposerDialog({
  open, onClose, businessRef, businessName, platforms, connectedPlatforms, onPosted,
}: PostComposerDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const overLimit = content.length > CONTENT_LIMIT;
  const scheduledInPast = Boolean(scheduledAt) && new Date(scheduledAt).getTime() <= Date.now();
  const canSubmit = content.trim().length > 0 && !overLimit && selected.length > 0 &&
    !busy && !uploading && !scheduledInPast;

  function reset() {
    setContent("");
    setSelected([]);
    setScheduledAt("");
    setMediaUrl(null);
    setMediaName(null);
  }

  function toggle(platform: string) {
    setSelected((prev) => {
      if (prev.includes(platform)) return prev.filter((p) => p !== platform);
      if (prev.length >= MAX_PLATFORMS) return prev;
      return [...prev, platform];
    });
  }

  function reportResults(results: PlatformResult[], scheduled: boolean, error: string | null) {
    const published = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    if (published.length && !failed.length) {
      toast({
        title: scheduled ? "Post scheduled" : "Post published",
        description: published.map((r) => platformLabel(r.platform)).join(", "),
      });
      return;
    }
    if (published.length && failed.length) {
      toast({
        title: "Partially published",
        description: `Went out on ${published.map((r) => platformLabel(r.platform)).join(", ")}. Failed on ${failed.map(describeFailure).join("; ")}.`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Nothing published",
      description: failed.length
        ? failed.map(describeFailure).join("; ")
        : (error ?? "The engine rejected the post."),
      variant: "destructive",
    });
  }

  async function pickImage(file: File) {
    setUploading(true);
    try {
      const encoded = await encodeImage(file);
      const { media, validation } = await registerMedia({
        businessRef,
        base64: encoded.base64,
        filename: file.name,
        mimeType: file.type || "image/jpeg",
        sizeBytes: file.size,
        width: encoded.width,
        height: encoded.height,
      });
      if (validation.valid === false) {
        toast({
          title: "Image rejected by the engine",
          description: validation.errors.join(" · ") || "No reason given.",
          variant: "destructive",
        });
        return;
      }
      setMediaUrl(media.originalUrl);
      setMediaName(file.name);
    } catch (e) {
      toast({
        title: "Image upload failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    setBusy(true);
    try {
      const result = await createPost({
        businessRef,
        platforms: selected,
        content,
        media: mediaUrl,
        scheduledFor: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      reportResults(result.results, result.scheduled, result.error);

      if (result.results.some((r) => r.ok)) {
        reset();
        onPosted();
        onClose();
      }
    } catch (e) {
      const code = isPartnerSocialError(e) ? e.code : "network_error";
      toast({
        title: code === "too_many_media" ? "One image per post" : "Publish failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New post — {businessName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Platforms
            </p>
            <div className="flex flex-wrap gap-2">
              {platforms.map((platform) => {
                const isSelected = selected.includes(platform);
                const isConnected = connectedPlatforms.includes(platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => toggle(platform)}
                    title={isConnected ? undefined : "No channel connected — this will fail for this platform only"}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    <PlatformMark platform={platform} />
                    {platformLabel(platform)}
                    {!isConnected && (
                      <span className="text-[10px] font-semibold text-warning">no channel</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              One to {MAX_PLATFORMS} platforms per post.
            </p>
          </div>

          <div className="space-y-1.5">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the post…"
              rows={5}
              className="resize-none"
            />
            <p className={cn(
              "text-right font-mono text-[11px]",
              overLimit ? "text-destructive" : "text-muted-foreground",
            )}>
              {content.length.toLocaleString()} / {CONTENT_LIMIT.toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Image
            </p>
            {mediaUrl ? (
              <div className="flex items-center gap-3">
                <img src={mediaUrl} alt="" className="h-14 w-14 rounded-lg border border-border object-cover" />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{mediaName}</span>
                <Button size="sm" variant="ghost" onClick={() => { setMediaUrl(null); setMediaName(null); }}>
                  <X />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                  {uploading ? "Uploading…" : "Choose image"}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Optional — except Instagram, which requires one. One image per post.
                </span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickImage(file);
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              When
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="rounded-lg border border-border bg-input px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50"
              />
              <Button size="sm" variant="ghost" onClick={() => setScheduledAt("")} disabled={!scheduledAt}>
                Clear
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {scheduledAt
                  ? scheduledInPast
                    ? "That time has passed — pick a future time."
                    : "Queued instead of published now."
                  : "Leave empty to publish now."}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <span className="mr-auto text-[11px] text-muted-foreground">
            {selected.length === 0
              ? "Pick at least one platform."
              : `${selected.length} platform${selected.length === 1 ? "" : "s"} selected`}
          </span>
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={submit}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />}
            {scheduledAt ? "Schedule" : "Publish now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
