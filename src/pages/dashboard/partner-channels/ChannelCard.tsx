import {
  CheckCircle2, AlertTriangle, Loader2, PlugZap, Unplug,
  Cloud, Facebook, Instagram, Linkedin, Music2, Share2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { platformLabel, type PartnerChannel } from "@/lib/partner-social";

// lucide has no Bluesky / TikTok mark yet — fall back to a neutral glyph.
const PLATFORM_ICONS: Record<string, LucideIcon> = {
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  bluesky: Cloud,
  tiktok: Music2,
};

export function PlatformMark({ platform }: { platform: string }) {
  const Icon = PLATFORM_ICONS[platform] ?? Share2;
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
      <Icon className="h-4 w-4" />
    </span>
  );
}

export type ChannelState = "connected" | "needs-reconnect" | "available" | "upcoming";

interface ChannelCardProps {
  platform: string;
  channel?: PartnerChannel | null;
  state: ChannelState;
  /** a call for this platform is in flight */
  busy: boolean;
  /** the OAuth round trip is open and we're polling for it to land */
  waiting: boolean;
  /** another platform is mid-connect */
  locked?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  /** stops polling for a connect that never landed */
  onCancelWait: () => void;
}

const FRAME: Record<ChannelState, string> = {
  connected: "border-success/40 bg-success/5",
  "needs-reconnect": "border-warning/50 bg-warning/5",
  available: "border-border bg-card",
  upcoming: "border-border/70 bg-muted/40",
};

export function ChannelCard({
  platform, channel, state, busy, waiting, locked, onConnect, onDisconnect, onCancelWait,
}: ChannelCardProps) {
  const label = platformLabel(platform);

  return (
    <div className={cn("rounded-xl border p-4 transition-colors", FRAME[state])}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <PlatformMark platform={platform} />
          <span className="truncate text-sm font-semibold text-foreground">{label}</span>
        </div>

        {state === "connected" && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
        {state === "needs-reconnect" && <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />}
        {state === "upcoming" && <Badge variant="secondary">Coming soon</Badge>}
      </div>

      {state === "connected" && (
        <div className="mb-3 space-y-1.5">
          <p className="truncate text-xs font-medium text-foreground">
            {channel?.display_name || channel?.handle || label}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {channel?.account_type === "organization" ? (
              <Badge variant="trust">Company Page</Badge>
            ) : channel?.account_type === "personal" ? (
              <Badge variant="outline">Personal profile</Badge>
            ) : null}
            {channel?.account_type === "personal" && (
              <span className="text-[11px] text-muted-foreground">
                Posts will come from a personal profile, not the company Page.
              </span>
            )}
          </div>
        </div>
      )}

      {state === "needs-reconnect" && (
        <p className="mb-3 text-[11px] text-foreground/80">
          Access was revoked at the provider. Publishing is paused until this is reconnected —
          a reconnect notice has already been emailed.
        </p>
      )}

      {state === "available" && (
        <p className="mb-3 text-[11px] text-muted-foreground">
          Not connected yet. Publishing to this platform will fail until it is.
        </p>
      )}

      {state === "upcoming" && (
        <p className="mb-3 text-[11px] text-muted-foreground">
          Not supported by the engine yet.
        </p>
      )}

      {waiting ? (
        <div className="flex items-center gap-2">
          <span className="flex flex-1 items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Waiting for authorisation…
          </span>
          <Button size="sm" variant="ghost" onClick={onCancelWait}>
            Cancel
          </Button>
        </div>
      ) : state === "connected" || state === "needs-reconnect" ? (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={state === "needs-reconnect" ? "default" : "outline"}
            className="flex-1"
            disabled={busy || locked}
            onClick={onConnect}
          >
            {busy ? <Loader2 className="animate-spin" /> : <PlugZap />}
            Reconnect
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            disabled={busy || locked}
            onClick={onDisconnect}
          >
            <Unplug />
            Disconnect
          </Button>
        </div>
      ) : state === "available" ? (
        <Button size="sm" className="w-full" disabled={busy || locked} onClick={onConnect}>
          {busy ? <Loader2 className="animate-spin" /> : <PlugZap />}
          Connect
        </Button>
      ) : null}
    </div>
  );
}
