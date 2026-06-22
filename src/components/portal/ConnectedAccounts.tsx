import { useState, useEffect, useCallback } from "react";
import { CheckCircle, Link2, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  { id: "google_business", label: "Google Business", note: "Required — connect first" },
  { id: "facebook",        label: "Facebook",        note: "Pages & profiles" },
  { id: "twitter",         label: "Twitter / X",     note: "Public posts" },
  { id: "linkedin",        label: "LinkedIn",        note: "Company pages" },
];

const PLATFORM_COLORS: Record<string, string> = {
  google_business: "#EA4335",
  facebook: "#1877F2",
  twitter: "#1DA1F2",
  linkedin: "#0A66C2",
};

interface Account { id: string; platform: string; account_name?: string }
interface Props { clientId: string }

export function ConnectedAccounts({ clientId }: Props) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("social-rpc", {
        body: { action: "accounts.list", payload: { client_id: clientId } },
      });
      setAccounts(data?.accounts ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const connect = async (platform: string) => {
    setConnecting(platform);
    try {
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: { action: "social.connect", payload: { platform, client_id: clientId } },
      });
      if (error || !data?.ok) {
        toast({ title: data?.error ?? "Connection error", variant: "destructive" });
        return;
      }
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "No auth URL returned from provider." });
      }
    } catch (e) {
      toast({ title: "Connection failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async (account: Account) => {
    try {
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: { action: "accounts.disconnect", payload: { id: account.id, client_id: clientId } },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message);
      toast({ title: `${account.platform} disconnected` });
      fetchAccounts();
    } catch (e) {
      toast({ title: "Disconnect failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const gbpConnected = accounts.some((a) => a.platform === "google_business");

  if (loading) {
    return <div className="py-8 text-center text-[rgba(238,241,250,0.3)] text-sm">Loading accounts…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
        Connected Platforms
      </div>
      {PLATFORMS.map((p) => {
        const account = accounts.find((a) => a.platform === p.id);
        const isConnected = !!account;
        const isDisabled = !isConnected && p.id !== "google_business" && !gbpConnected;
        const color = PLATFORM_COLORS[p.id] ?? "#EEF1FA";

        return (
          <div
            key={p.id}
            className="flex items-center justify-between bg-card rounded-xl px-5 py-4 border border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "25" }}>
                <span className="text-[10px] font-extrabold" style={{ color }}>{p.label[0]}</span>
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{p.label}</div>
                <div className="text-[11px] text-muted-foreground/70">
                  {isConnected ? (account.account_name ?? "Connected") : p.note}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                  <button
                    onClick={() => disconnect(account)}
                    className="text-muted-foreground/50 hover:text-red-400 transition-colors ml-1"
                    title="Disconnect"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => connect(p.id)}
                  disabled={isDisabled || connecting === p.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors disabled:opacity-35 disabled:cursor-not-allowed border-white/15 text-muted-foreground hover:enabled:border-[#0078D7] hover:enabled:text-primary"
                  title={isDisabled ? "Connect Google Business first" : undefined}
                >
                  <Link2 className="w-3 h-3" />
                  {connecting === p.id ? "Connecting…" : "Connect"}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {!gbpConnected && (
        <p className="text-[11px] text-muted-foreground/70 text-center pt-2">
          Connect Google Business first to unlock other platforms.
        </p>
      )}
    </div>
  );
}
