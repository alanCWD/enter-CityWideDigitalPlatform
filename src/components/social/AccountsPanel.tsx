import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Globe, Instagram, Linkedin, Twitter, Facebook, Youtube,
  CheckCircle2, AlertCircle, Loader2, PlugZap, Unplug, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ZernioAccount } from "@/hooks/useZernioAccounts";

/* ── Platform metadata ─────────────────────────────────────────────────────── */
interface PlatformMeta {
  id: string;         // Zernio API value
  label: string;
  Icon: React.ElementType;
  color: string;
}

const PLATFORMS: PlatformMeta[] = [
  { id: "googlebusiness", label: "Google Business", Icon: Globe,      color: "text-blue-500"   },
  { id: "instagram",      label: "Instagram",        Icon: Instagram,  color: "text-pink-500"   },
  { id: "linkedin",       label: "LinkedIn",          Icon: Linkedin,   color: "text-blue-600"   },
  { id: "twitter",        label: "X (Twitter)",       Icon: Twitter,    color: "text-foreground" },
  { id: "facebook",       label: "Facebook",          Icon: Facebook,   color: "text-blue-500"   },
  { id: "youtube",        label: "YouTube",           Icon: Youtube,    color: "text-red-500"    },
  { id: "tiktok",         label: "TikTok",            Icon: () => <span className="text-[11px] font-black">TK</span>, color: "text-foreground" },
  { id: "pinterest",      label: "Pinterest",         Icon: () => <span className="text-[11px] font-black">P</span>,  color: "text-red-500"   },
  { id: "threads",        label: "Threads",           Icon: () => <span className="text-[11px] font-black">Th</span>, color: "text-foreground" },
  { id: "reddit",         label: "Reddit",            Icon: () => <span className="text-[11px] font-black">Re</span>, color: "text-orange-500" },
  { id: "bluesky",        label: "Bluesky",           Icon: () => <span className="text-[11px] font-black">Bs</span>, color: "text-sky-500"    },
  { id: "telegram",       label: "Telegram",          Icon: () => <span className="text-[11px] font-black">Tg</span>, color: "text-blue-400"   },
  { id: "snapchat",       label: "Snapchat",          Icon: () => <span className="text-[11px] font-black">Sc</span>, color: "text-yellow-400" },
  { id: "discord",        label: "Discord",           Icon: () => <span className="text-[11px] font-black">Dc</span>, color: "text-indigo-400" },
  { id: "whatsapp",       label: "WhatsApp",          Icon: () => <span className="text-[11px] font-black">WA</span>, color: "text-green-500"  },
];

/* ── Props ─────────────────────────────────────────────────────────────────── */
interface Props {
  profileId: string | null;
  profileLoading: boolean;
  accounts: ZernioAccount[];
  accountsLoading: boolean;
  accountsError: string | null;
  onReload: () => void;
}

export function AccountsPanel({ profileId, profileLoading, accounts, accountsLoading, accountsError, onReload }: Props) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  /* Handle OAuth return ──────────────────────────────────────────────────── */
  useEffect(() => {
    const connectedPlatform = searchParams.get("connected");
    if (connectedPlatform === "true" || connectedPlatform) {
      const platform = searchParams.get("platform") ?? connectedPlatform;
      toast({ title: "Account connected", description: `${platform} was connected successfully.` });
      const next = new URLSearchParams(searchParams);
      next.delete("connected");
      next.delete("platform");
      next.set("tab", "accounts");
      setSearchParams(next, { replace: true });
      onReload();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Connect ─────────────────────────────────────────────────────────────── */
  async function handleConnect(platform: string) {
    if (!profileId) { toast({ title: "Profile not ready", variant: "destructive" }); return; }
    try {
      const origin = window.location.origin;
      const redirectUri = `${origin}/dashboard/social/calendar?tab=accounts&connected=true&platform=${platform}`;
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: {
          action: "social.connect",
          payload: { platform, profile_id: profileId, redirect_uri: redirectUri },
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.authUrl) { window.location.href = data.authUrl; }
    } catch (e) {
      toast({ title: "Connection failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  /* Disconnect ──────────────────────────────────────────────────────────── */
  async function handleDisconnect(account: ZernioAccount) {
    if (!confirm(`Disconnect ${account.displayName} (${account.platform})?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: { action: "zernio.disconnect", payload: { account_id: account._id } },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: "Disconnected", description: `${account.displayName} was removed.` });
      onReload();
    } catch (e) {
      toast({ title: "Disconnect failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  /* Accounts grouped by platform ─────────────────────────────────────────── */
  const byPlatform = new Map<string, ZernioAccount[]>();
  for (const acct of accounts) {
    const key = acct.platform;
    if (!byPlatform.has(key)) byPlatform.set(key, []);
    byPlatform.get(key)!.push(acct);
  }

  const connectedCount = accounts.filter((a) => a.isActive).length;

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">Connected Accounts</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {accountsLoading ? "Loading…" : `${connectedCount} active account${connectedCount !== 1 ? "s" : ""} across ${byPlatform.size} platform${byPlatform.size !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={onReload}
          disabled={accountsLoading}
          className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${accountsLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {accountsError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {accountsError}
        </div>
      )}

      {profileLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Setting up Zernio profile…
        </div>
      )}

      {/* Platform grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const connected = byPlatform.get(p.id) ?? [];
          const hasActive = connected.some((a) => a.isActive);
          const hasDisconnected = connected.some((a) => !a.isActive);

          return (
            <div
              key={p.id}
              className={`rounded-xl border p-4 transition-colors ${
                hasActive
                  ? "border-green-500/30 bg-green-500/5"
                  : hasDisconnected
                  ? "border-yellow-500/30 bg-yellow-500/5"
                  : "border-border bg-card"
              }`}
            >
              {/* Platform header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg bg-muted flex items-center justify-center ${p.color}`}>
                    <p.Icon />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{p.label}</span>
                </div>
                {hasActive && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                {!hasActive && hasDisconnected && <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
              </div>

              {/* Connected accounts list */}
              {connected.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {connected.map((acct) => (
                    <div key={acct._id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{acct.displayName || acct.username}</p>
                        {acct.username && acct.username !== acct.displayName && (
                          <p className="text-[10px] text-muted-foreground truncate">{acct.username}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          acct.isActive
                            ? "bg-green-500/15 text-green-600 dark:text-green-400"
                            : "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                        }`}>
                          {acct.isActive ? "Active" : "Expired"}
                        </span>
                        <button
                          onClick={() => handleDisconnect(acct)}
                          title="Disconnect"
                          className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Unplug className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Connect / Add another button */}
              <button
                onClick={() => handleConnect(p.id)}
                disabled={profileLoading || !profileId}
                className={`w-full flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                  connected.length > 0
                    ? "border-border text-muted-foreground hover:bg-muted"
                    : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                <PlugZap className="w-3 h-3" />
                {connected.length > 0 ? "Add another" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
