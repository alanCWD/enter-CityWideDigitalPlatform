import { useState } from "react";
import { Send, Clock, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  { id: "google_business", label: "Google Business", color: "#EA4335", required: true },
  { id: "facebook", label: "Facebook", color: "#1877F2", required: false },
  { id: "twitter", label: "Twitter / X", color: "#1DA1F2", required: false },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2", required: false },
];

const CHAR_LIMITS: Record<string, number> = {
  google_business: 1500,
  facebook: 63206,
  twitter: 280,
  linkedin: 3000,
};

interface Props {
  clientId: string;
  onPostCreated: () => void;
}

export function PostComposer({ clientId, onPostCreated }: Props) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["google_business"]);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);

  const togglePlatform = (id: string) => {
    if (id === "google_business") return; // required
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  // Effective char limit = most restrictive selected platform
  const charLimit = Math.min(...selectedPlatforms.map((p) => CHAR_LIMITS[p] ?? 1500));
  const remaining = charLimit - content.length;
  const overLimit = remaining < 0;

  const handleSubmit = async () => {
    if (!content.trim()) return;
    if (overLimit) return;
    if (mode === "schedule" && !scheduledAt) {
      toast({ title: "Pick a date/time to schedule.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: {
          action: "posts.create",
          payload: {
            client_id: clientId,
            content,
            platforms: selectedPlatforms,
            scheduled_at: mode === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
            delay_minutes: delayMinutes,
          },
        },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? "Unknown error");
      toast({ title: "Post queued successfully!" });
      setContent("");
      setScheduledAt("");
      setDelayMinutes(0);
      onPostCreated();
    } catch (e) {
      toast({ title: "Failed to queue post", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isTwitterSelected = selectedPlatforms.includes("twitter");

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Compose Post</span>
        </div>

        {/* Platform toggles */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PLATFORMS.map((p) => {
            const selected = selectedPlatforms.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  selected
                    ? "border-transparent text-white"
                    : "border-white/15 text-muted-foreground hover:border-white/30"
                } ${p.required ? "cursor-default" : "cursor-pointer"}`}
                style={selected ? { backgroundColor: p.color } : {}}
                title={p.required ? "Google Business is always included" : undefined}
              >
                {p.label}
                {p.required && <span className="text-[9px] opacity-70 ml-0.5">required</span>}
              </button>
            );
          })}
        </div>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your post here…"
          rows={4}
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 resize-none"
        />

        {/* Char counter */}
        <div className={`text-right text-xs mt-1 font-mono ${overLimit ? "text-red-400" : remaining < 50 && isTwitterSelected ? "text-yellow-400" : "text-[rgba(238,241,250,0.3)]"}`}>
          {remaining.toLocaleString()} / {charLimit.toLocaleString()}
        </div>

        {/* Schedule toggle */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setMode("now")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${mode === "now" ? "bg-primary border-[#0078D7] text-white" : "border-white/15 text-muted-foreground hover:border-white/30"}`}
          >
            Post Now
          </button>
          <button
            onClick={() => setMode("schedule")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${mode === "schedule" ? "bg-primary border-[#0078D7] text-white" : "border-white/15 text-muted-foreground hover:border-white/30"}`}
          >
            <Clock className="w-3 h-3" />
            Schedule
          </button>

          {mode === "schedule" && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/60"
            />
          )}
        </div>

        {/* Advanced / delay settings */}
        {selectedPlatforms.length > 1 && (
          <div className="mt-4">
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-muted-foreground transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Advanced — Platform Delay
            </button>

            {showAdvanced && (
              <div className="mt-3 bg-muted rounded-xl p-4 border border-border">
                <div className="text-[11px] text-muted-foreground mb-3">
                  GBP posts first. Set a delay before syndicating to other platforms.
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24">Other platforms</span>
                  <input
                    type="range"
                    min={0}
                    max={120}
                    step={5}
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(Number(e.target.value))}
                    className="flex-1 accent-[#0078D7]"
                  />
                  <span className="text-xs font-bold text-primary w-16 text-right">
                    {delayMinutes === 0 ? "No delay" : `+${delayMinutes} min`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 bg-muted border-t border-border flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground/70">
          {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? "s" : ""} selected
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !content.trim() || overLimit}
          className="flex items-center gap-2 bg-primary hover:bg-[#005FA3] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          {loading ? "Publishing…" : mode === "schedule" ? "Schedule Post" : "Publish Now"}
        </button>
      </div>
    </div>
  );
}
