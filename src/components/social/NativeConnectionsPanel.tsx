import { useEffect, useRef, useState } from "react";
import {
  Linkedin, Facebook, Instagram, CheckCircle2, AlertCircle,
  Loader2, PlugZap, RefreshCw, LogOut,
} from "lucide-react";
import { social } from "@/lib/social";
import { useToast } from "@/hooks/use-toast";
import { useLinkedInStatus, useMetaStatus } from "@/hooks/useNativeChannels";

const CONNECT_CTX_KEY = "social_connect_ctx";

interface ConnectCardProps {
  title: string;
  icon: React.ElementType;
  color: string;
  status: "loading" | "connected" | "disconnected" | "needs-reconnect";
  displayName?: string | null;
  accountLabel?: string | null;
  onConnect: () => Promise<void>;
  onReconnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onCheck: () => Promise<void>;
}

function ConnectCard({ title, icon: Icon, color, status, displayName, accountLabel, onConnect, onReconnect, onDisconnect, onCheck }: ConnectCardProps) {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { /* toast handled by caller */ } finally { setBusy(false); }
  };

  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      status === "connected"
        ? "border-green-500/30 bg-green-500/5"
        : status === "needs-reconnect"
          ? "border-yellow-500/30 bg-yellow-500/5"
          : "border-border bg-card"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg bg-muted flex items-center justify-center ${color}`}>
            <Icon />
          </div>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {status === "connected" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        {status === "needs-reconnect" && <AlertCircle className="w-4 h-4 text-yellow-500" />}
      </div>

      {status === "connected" && (
        <div className="space-y-1.5 mb-3">
          <p className="text-xs font-medium text-foreground truncate">{displayName || title}</p>
          {accountLabel && <p className="text-[10px] text-muted-foreground truncate">{accountLabel}</p>}
        </div>
      )}

      {status === "needs-reconnect" && (
        <p className="text-[11px] text-yellow-600 dark:text-yellow-400 mb-3">
          Connection expired or revoked — reconnect to keep publishing.
        </p>
      )}

      <div className="flex gap-1.5">
        {status === "connected" ? (
          <>
            <button
              onClick={() => run(onCheck)}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Check
            </button>
            <button
              onClick={() => run(onDisconnect)}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <LogOut className="w-3 h-3" />
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => run(status === "needs-reconnect" ? onReconnect : onConnect)}
            disabled={busy || status === "loading"}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
              status === "needs-reconnect"
                ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20"
                : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlugZap className="w-3 h-3" />}
            {status === "needs-reconnect" ? "Reconnect" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Native LinkedIn + Meta connect cards. Opens the OAuth provider in a popup,
 * polls for popup close, and listens for the `app_channel_connected` /
 * `app_channel_error` postMessage from the callback page.
 */
export function NativeConnectionsPanel({ onConnectionsChanged }: { onConnectionsChanged?: () => void }) {
  const { toast } = useToast();
  const linkedin = useLinkedInStatus();
  const meta = useMetaStatus();
  const popupRef = useRef<Window | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  useEffect(() => {
    // On mount, run the health-check hooks once so a revoked token surfaces
    // before the next publish (throttled server-side).
    if (linkedin.status === "connected") linkedin.checkNow();
    if (meta.facebookStatus === "connected") meta.checkNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.app_channel_connected) {
        toast({ title: "Connected", description: "Social channel connected successfully." });
        setConnectingPlatform(null);
        linkedin.reload();
        meta.reload();
        onConnectionsChanged?.();
      }
      if (event.data?.app_channel_error) {
        toast({ title: "Connection failed", description: event.data.app_channel_error, variant: "destructive" });
        setConnectingPlatform(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPopup = async (platform: "linkedin" | "meta") => {
    try {
      const res = await social<{ ok: boolean; authUrl: string }>("connect.start", { platform });
      localStorage.setItem(CONNECT_CTX_KEY, JSON.stringify({ platform }));
      setConnectingPlatform(platform);
      const popup = window.open("about:blank", "_blank", "width=560,height=700");
      if (!popup) { toast({ title: "Popup blocked", description: "Allow popups for this site and try again.", variant: "destructive" }); return; }
      popupRef.current = popup;
      popup.location.href = res.authUrl;
    } catch (e) {
      toast({ title: "Connection failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const disconnect = async (platform: string) => {
    if (!confirm(`Disconnect ${platform === "meta" ? "Facebook + Instagram" : "LinkedIn"}?`)) return;
    try {
      await social("connection.disconnect", { platform });
      toast({ title: "Disconnected" });
      linkedin.reload();
      meta.reload();
    } catch (e) {
      toast({ title: "Disconnect failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">Native Direct Connections</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Publish straight to LinkedIn and Meta (Facebook + Instagram) — no third-party service.
          </p>
        </div>
        {(connectingPlatform || linkedin.status === "loading" || meta.loading) && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ConnectCard
          title="LinkedIn"
          icon={Linkedin}
          color="text-blue-600"
          status={linkedin.status}
          displayName={linkedin.displayName}
          accountLabel={linkedin.accountType === "organization" ? "Company Page" : linkedin.handle}
          onConnect={() => openPopup("linkedin")}
          onReconnect={() => openPopup("linkedin")}
          onDisconnect={() => disconnect("linkedin")}
          onCheck={linkedin.checkNow}
        />
        <ConnectCard
          title="Facebook"
          icon={Facebook}
          color="text-blue-500"
          status={meta.facebookStatus}
          displayName={meta.facebookDisplayName}
          onConnect={() => openPopup("meta")}
          onReconnect={() => openPopup("meta")}
          onDisconnect={() => disconnect("meta")}
          onCheck={meta.checkNow}
        />
        <ConnectCard
          title="Instagram"
          icon={Instagram}
          color="text-pink-500"
          status={meta.instagramStatus}
          displayName={meta.instagramDisplayName}
          onConnect={() => openPopup("meta")}
          onReconnect={() => openPopup("meta")}
          onDisconnect={() => disconnect("meta")}
          onCheck={meta.checkNow}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Instagram connects through a Facebook Page with a linked Instagram Business account — one Meta login covers both.
      </p>
    </div>
  );
}

export { CONNECT_CTX_KEY };
