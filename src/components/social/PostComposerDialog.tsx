import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Globe, Instagram, Linkedin, Twitter, Facebook, Youtube,
  Loader2, ImagePlus, X, Link, CheckCircle2,
} from "lucide-react";
import type { ZernioAccount } from "@/hooks/useZernioAccounts";

/* ── Platform icons ─────────────────────────────────────────────────────── */
const PLATFORM_META: Record<string, { label: string; Icon: React.ElementType }> = {
  googlebusiness:  { label: "Google Business", Icon: Globe      },
  google_business: { label: "Google Business", Icon: Globe      },
  instagram:       { label: "Instagram",        Icon: Instagram  },
  linkedin:        { label: "LinkedIn",          Icon: Linkedin   },
  twitter:         { label: "X (Twitter)",       Icon: Twitter    },
  facebook:        { label: "Facebook",          Icon: Facebook   },
  youtube:         { label: "YouTube",           Icon: Youtube    },
  tiktok:          { label: "TikTok",            Icon: () => <span className="text-[10px] font-black">TK</span> },
  pinterest:       { label: "Pinterest",         Icon: () => <span className="text-[10px] font-black">P</span>  },
  threads:         { label: "Threads",           Icon: () => <span className="text-[10px] font-black">Th</span> },
  reddit:          { label: "Reddit",            Icon: () => <span className="text-[10px] font-black">Re</span> },
  bluesky:         { label: "Bluesky",           Icon: () => <span className="text-[10px] font-black">Bs</span> },
  telegram:        { label: "Telegram",          Icon: () => <span className="text-[10px] font-black">Tg</span> },
  snapchat:        { label: "Snapchat",          Icon: () => <span className="text-[10px] font-black">Sc</span> },
  discord:         { label: "Discord",           Icon: () => <span className="text-[10px] font-black">Dc</span> },
  whatsapp:        { label: "WhatsApp",          Icon: () => <span className="text-[10px] font-black">WA</span> },
};

const GBP_CTA_OPTIONS = [
  { value: "NONE", label: "No button" },
  { value: "BOOK", label: "Book" },
  { value: "ORDER", label: "Order online" },
  { value: "SHOP", label: "Buy" },
  { value: "LEARN_MORE", label: "Learn more" },
  { value: "SIGN_UP", label: "Sign up" },
  { value: "GET_OFFER", label: "Get offer" },
  { value: "CALL", label: "Call" },
  { value: "CUSTOM", label: "Custom link" },
];

export interface PostDraft {
  id?: string;
  title: string;
  content: string;
  platforms: string[];
  scheduled_at: string;
  status: string;
  media_urls?: string[];
  gbp_cta_type?: string;
  gbp_cta_url?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
  initialPost?: PostDraft;
  onSaved: () => void;
  /** Live Zernio accounts — passed from the calendar page */
  zernioAccounts?: ZernioAccount[];
  /** Zernio profile ID for this agency */
  profileId?: string | null;
}

export function PostComposerDialog({ open, onClose, defaultDate, initialPost, onSaved, zernioAccounts = [], profileId }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  // selectedAccountIds: Zernio account _id values
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState(defaultDate ?? "");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  // Media state
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // GBP CTA state
  const [gbpCtaType, setGbpCtaType] = useState("NONE");
  const [gbpCtaUrl, setGbpCtaUrl] = useState("");

  // Pre-fill when editing
  useEffect(() => {
    if (initialPost) {
      setTitle(initialPost.title ?? "");
      setContent(initialPost.content ?? "");
      setImageUrls(initialPost.media_urls ?? []);
      setGbpCtaType(initialPost.gbp_cta_type ?? "NONE");
      setGbpCtaUrl(initialPost.gbp_cta_url ?? "");
      if (initialPost.scheduled_at) {
        const d = new Date(initialPost.scheduled_at);
        setScheduledDate(d.toISOString().slice(0, 10));
        setScheduledTime(d.toTimeString().slice(0, 5));
      }
      // Try to match saved platform names back to account IDs
      if (initialPost.platforms?.length && zernioAccounts.length) {
        const ids = zernioAccounts
          .filter((a) => initialPost.platforms.includes(a.platform) || initialPost.platforms.includes(a._id))
          .map((a) => a._id);
        setSelectedAccountIds(ids);
      }
    } else {
      setTitle("");
      setContent("");
      setSelectedAccountIds([]);
      setImageUrls([]);
      setGbpCtaType("NONE");
      setGbpCtaUrl("");
      setScheduledDate(defaultDate ?? "");
      setScheduledTime("09:00");
    }
  }, [initialPost, defaultDate, open]);

  function toggleAccount(id: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 10MB.", variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    try {
      const fileName = `posts/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error } = await supabase.storage.from("post-media").upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("post-media").getPublicUrl(fileName);
      setImageUrls((prev) => [...prev, urlData.publicUrl]);
      toast({ title: "Image uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  }

  const selectedAccounts = zernioAccounts.filter((a) => selectedAccountIds.includes(a._id));
  const showGbpCta = selectedAccounts.some((a) => a.platform === "googlebusiness" || a.platform === "google_business");
  const uniquePlatforms = [...new Set(selectedAccounts.map((a) => a.platform))];

  async function handleSave(action: "draft" | "schedule" | "publish") {
    if (!content.trim()) {
      toast({ title: "Content required", description: "Please write some content.", variant: "destructive" });
      return;
    }
    if (action !== "draft" && selectedAccountIds.length === 0) {
      toast({ title: "Select an account", description: "Choose at least one connected account.", variant: "destructive" });
      return;
    }
    if (action === "schedule" && !scheduledDate) {
      toast({ title: "Date required", description: "Please pick a scheduled date.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const scheduledAt =
        action !== "draft" && scheduledDate
          ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
          : null;
      const status = action === "publish" ? "published" : action === "schedule" ? "scheduled" : "draft";
      const publishedAt = action === "publish" ? new Date().toISOString() : null;

      // Build Zernio platforms array with real accountIds
      const zernioPlatforms = selectedAccounts.map((a) => ({
        platform: a.platform,
        accountId: a._id,
      }));

      const commonPayload: Record<string, unknown> = {
        title: title || content.slice(0, 60),
        content,
        platforms: uniquePlatforms,
        client_id: "citywide",
        agency_id: "citywide",
        status,
        scheduled_at: scheduledAt,
        published_at: publishedAt,
        media_urls: imageUrls,
        gbp_cta_type: showGbpCta && gbpCtaType !== "NONE" ? gbpCtaType : null,
        gbp_cta_url: showGbpCta && gbpCtaType !== "NONE" ? gbpCtaUrl : null,
      };

      // Save/update in Supabase posts table
      if (initialPost?.id) {
        await supabase.from("posts").update(commonPayload).eq("id", initialPost.id);
      } else {
        const id = `post-${Date.now()}`;
        await supabase.from("posts").insert({ id, ...commonPayload });
      }

      // Publish or schedule via Zernio if not draft and we have accounts + profileId
      if (action !== "draft" && zernioPlatforms.length > 0 && profileId) {
        const { data } = await supabase.functions.invoke("social-rpc", {
          body: {
            action: "zernio.posts.create",
            payload: {
              profile_id: profileId,
              title: title || content.slice(0, 60),
              content,
              accounts: zernioPlatforms,
              scheduled_for: action === "schedule" ? scheduledAt : undefined,
              publish_now: action === "publish",
              media_urls: imageUrls.length > 0 ? imageUrls : undefined,
            },
          },
        });
        if (data?.error) {
          toast({ title: "Zernio warning", description: data.error, variant: "destructive" });
        }
      }

      toast({
        title: action === "draft" ? "Saved as draft" : action === "schedule" ? "Post scheduled" : "Published",
        description: action === "schedule" ? `Publishes on ${scheduledDate} at ${scheduledTime}` : undefined,
      });

      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const activeAccounts = zernioAccounts.filter((a) => a.isActive);
  const noAccounts = zernioAccounts.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialPost?.id ? "Edit Post" : "Compose Post"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="post-title">Title (optional)</Label>
            <Input
              id="post-title"
              placeholder="Short label for calendar display"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Content */}
          <div className="space-y-1">
            <Label htmlFor="post-content">Content</Label>
            <Textarea
              id="post-content"
              placeholder="Write your post content…"
              rows={5}
              maxLength={2200}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground text-right">{content.length}/2200</p>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Image</Label>
            {imageUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {imageUrls.map((url) => (
                  <div key={url} className="relative group">
                    <img src={url} alt="" className="w-24 h-24 object-cover rounded-md border border-border" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || imageUrls.length >= 4}
                className="flex items-center gap-2"
              >
                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploadingImage ? "Uploading…" : "Upload image"}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
          </div>

          {/* Accounts selector */}
          <div className="space-y-2">
            <Label>Publish to</Label>
            {noAccounts ? (
              <p className="text-sm text-muted-foreground py-2">
                No connected accounts. Go to the <strong>Accounts</strong> tab to connect platforms first.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {zernioAccounts.map((acct) => {
                  const meta = PLATFORM_META[acct.platform] ?? { label: acct.platform, Icon: Globe };
                  const selected = selectedAccountIds.includes(acct._id);
                  return (
                    <button
                      key={acct._id}
                      type="button"
                      onClick={() => toggleAccount(acct._id)}
                      disabled={!acct.isActive}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors disabled:opacity-40 ${
                        selected ? "border-primary bg-primary/8" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="w-5 h-5 flex items-center justify-center text-muted-foreground flex-shrink-0">
                        <meta.Icon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{acct.displayName || acct.username}</p>
                        <p className="text-[10px] text-muted-foreground">{meta.label}</p>
                      </div>
                      {selected && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                      {!acct.isActive && <span className="text-[9px] text-yellow-500 font-bold">Expired</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* GBP CTA */}
          {showGbpCta && (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Google Business CTA Button</Label>
              </div>
              <div className="space-y-1">
                <Label htmlFor="gbp-cta-type" className="text-xs">Button type</Label>
                <Select value={gbpCtaType} onValueChange={setGbpCtaType}>
                  <SelectTrigger id="gbp-cta-type" className="h-9">
                    <SelectValue placeholder="Select button type" />
                  </SelectTrigger>
                  <SelectContent>
                    {GBP_CTA_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {gbpCtaType !== "NONE" && gbpCtaType !== "CALL" && (
                <div className="space-y-1">
                  <Label htmlFor="gbp-cta-url" className="text-xs">Destination URL</Label>
                  <Input
                    id="gbp-cta-url"
                    placeholder="https://example.com"
                    value={gbpCtaUrl}
                    onChange={(e) => setGbpCtaUrl(e.target.value)}
                    className="h-9"
                  />
                </div>
              )}
            </div>
          )}

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sched-date">Date</Label>
              <Input id="sched-date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sched-time">Time</Label>
              <Input id="sched-time" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
          </div>

          {/* Selected account summary badges */}
          {selectedAccounts.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedAccounts.map((a) => (
                <Badge key={a._id} variant="secondary" className="text-xs">
                  {a.displayName || PLATFORM_META[a.platform]?.label || a.platform}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Draft"}
          </Button>
          <Button variant="secondary" onClick={() => handleSave("schedule")} disabled={saving}>
            Schedule
          </Button>
          <Button onClick={() => handleSave("publish")} disabled={saving}>
            Publish Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
