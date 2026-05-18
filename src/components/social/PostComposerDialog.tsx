import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Instagram, Linkedin, Twitter, Facebook, Youtube, Loader2 } from "lucide-react";

const PLATFORM_META: Record<string, { label: string; Icon: React.ElementType }> = {
  google_business: { label: "Google Business", Icon: Globe },
  instagram: { label: "Instagram", Icon: Instagram },
  linkedin: { label: "LinkedIn", Icon: Linkedin },
  twitter: { label: "X (Twitter)", Icon: Twitter },
  facebook: { label: "Facebook", Icon: Facebook },
  youtube: { label: "YouTube", Icon: Youtube },
};

export interface PostDraft {
  id?: string;
  title: string;
  content: string;
  platforms: string[];
  scheduled_at: string;
  status: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate?: string; // ISO date string YYYY-MM-DD
  initialPost?: PostDraft;
  onSaved: () => void;
}

export function PostComposerDialog({ open, onClose, defaultDate, initialPost, onSaved }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState(defaultDate ?? "");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Load connected platforms
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("social_accounts")
        .select("platform")
        .eq("client_id", "citywide")
        .eq("status", "connected");
      if (data) setConnectedPlatforms(data.map((d) => d.platform));
    }
    load();
  }, []);

  // Pre-fill when editing
  useEffect(() => {
    if (initialPost) {
      setTitle(initialPost.title ?? "");
      setContent(initialPost.content ?? "");
      setSelectedPlatforms(initialPost.platforms ?? []);
      if (initialPost.scheduled_at) {
        const d = new Date(initialPost.scheduled_at);
        setScheduledDate(d.toISOString().slice(0, 10));
        setScheduledTime(d.toTimeString().slice(0, 5));
      }
    } else {
      setTitle("");
      setContent("");
      setSelectedPlatforms([]);
      setScheduledDate(defaultDate ?? "");
      setScheduledTime("09:00");
    }
  }, [initialPost, defaultDate, open]);

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleSave(action: "draft" | "schedule" | "publish") {
    if (!content.trim()) {
      toast({ title: "Content required", description: "Please write some content.", variant: "destructive" });
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast({ title: "Select a platform", description: "Choose at least one platform.", variant: "destructive" });
      return;
    }
    if (action === "schedule" && !scheduledDate) {
      toast({ title: "Date required", description: "Please pick a scheduled date.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const scheduledAt = action !== "draft" && scheduledDate
        ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
        : null;

      const status = action === "publish" ? "published" : action === "schedule" ? "scheduled" : "draft";
      const publishedAt = action === "publish" ? new Date().toISOString() : null;

      const payload: Record<string, unknown> = {
        title: title || content.slice(0, 60),
        content,
        platforms: selectedPlatforms,
        client_id: "citywide",
        agency_id: "citywide",
        status,
        scheduled_at: scheduledAt,
        published_at: publishedAt,
        // posts table requires social_account_id — use first platform as reference
        social_account_id: selectedPlatforms[0],
      };

      if (initialPost?.id) {
        await supabase.from("posts").update(payload).eq("id", initialPost.id);
      } else {
        const id = `post-${Date.now()}`;
        await supabase.from("posts").insert({ id, ...payload });
      }

      // If publishing now, call Zernio via edge function
      if (action === "publish") {
        const { data } = await supabase.functions.invoke("social-rpc", {
          body: {
            action: "social.post",
            payload: { content, platforms: selectedPlatforms, client_id: "citywide" },
          },
        });
        if (data?.error) {
          toast({ title: "Zernio warning", description: data.error, variant: "destructive" });
        }
      }

      toast({
        title: action === "draft" ? "Saved as draft" : action === "schedule" ? "Post scheduled" : "Published",
        description:
          action === "schedule"
            ? `Will publish on ${scheduledDate} at ${scheduledTime}`
            : undefined,
      });

      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* Platforms */}
          <div className="space-y-2">
            <Label>Platforms</Label>
            {connectedPlatforms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No connected platforms. Connect accounts in Social Profiles first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {connectedPlatforms.map((p) => {
                  const meta = PLATFORM_META[p];
                  if (!meta) return null;
                  const { label, Icon } = meta;
                  const checked = selectedPlatforms.includes(p);
                  return (
                    <label
                      key={p}
                      className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer transition-colors ${
                        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePlatform(p)}
                      />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sched-date">Date</Label>
              <Input
                id="sched-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sched-time">Time</Label>
              <Input
                id="sched-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          {/* Selected summary */}
          {selectedPlatforms.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedPlatforms.map((p) => (
                <Badge key={p} variant="secondary" className="text-xs">
                  {PLATFORM_META[p]?.label ?? p}
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
