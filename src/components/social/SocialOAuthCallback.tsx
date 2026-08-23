import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, Linkedin, Facebook, User, Building2, Globe } from "lucide-react";
import { social } from "@/lib/social";
import { CONNECT_CTX_KEY } from "@/components/social/NativeConnectionsPanel";

const POST_CONNECTED = "app_channel_connected";
const POST_ERROR = "app_channel_error";

interface FinalizeResult {
  ok: boolean;
  error?: string;
  displayName?: string;
  handle?: string;
  organizations?: { urn: string; name: string }[];
  agency_id?: string;
  pages?: { id: string; name: string; access_token: string }[];
  facebookConnected?: boolean;
  instagramConnected?: boolean;
}

function notifyOpener(message: unknown) {
  try {
    if (window.opener) window.opener.postMessage(message, window.location.origin);
  } catch {
    /* opener may be gone */
  }
}

/** Shared OAuth callback handler used by /auth/linkedin/callback and /auth/meta/callback. */
export function SocialOAuthCallback({ platform }: { platform: "linkedin" | "meta" }) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Exchanging authorization code…");
  const [pendingResult, setPendingResult] = useState<FinalizeResult | null>(null);
  const [selecting, setSelecting] = useState(false);
  const ran = useRef(false);

  const platformName = platform === "linkedin" ? "LinkedIn" : "Facebook / Instagram";
  const Icon = platform === "linkedin" ? Linkedin : Facebook;
  const color = platform === "linkedin" ? "text-blue-600" : "text-blue-500";

  const finish = (result: FinalizeResult) => {
    if (result.error) {
      setStatus("error");
      setMessage(result.error);
      notifyOpener({ [POST_ERROR]: result.error });
      setTimeout(() => window.close(), 2000);
      return;
    }
    setStatus("success");
    setMessage(`Connected to ${platformName}! You can close this window.`);
    notifyOpener({ [POST_CONNECTED]: true, platform });
    localStorage.removeItem(CONNECT_CTX_KEY);
    setTimeout(() => window.close(), 1500);
  };

  const selectAndFinish = async (result: FinalizeResult, payload: Record<string, unknown>) => {
    setSelecting(true);
    try {
      const selected = await social<{ ok: boolean }>("connect.select", payload);
      if (!selected?.ok) throw new Error("Failed to store the selection.");
      finish(result);
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message || "Failed to store the selection.");
      notifyOpener({ [POST_ERROR]: (err as Error).message });
    } finally {
      setSelecting(false);
    }
  };

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Determine whether this is a connect flow (vs. a plain redirect) from the
    // context saved by the Channels page before opening the popup.
    let isConnect = false;
    try {
      const ctx = JSON.parse(localStorage.getItem(CONNECT_CTX_KEY) || "null");
      isConnect = !!ctx && ctx.platform === platform;
    } catch { /* ignore */ }

    if (error) {
      const msg = error === "access_denied" ? "You denied access." : `Provider error: ${error}`;
      setStatus("error");
      setMessage(msg);
      notifyOpener({ [POST_ERROR]: msg });
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Missing authorization code or state.");
      notifyOpener({ [POST_ERROR]: "Missing authorization code or state." });
      return;
    }
    if (!isConnect) {
      setStatus("error");
      setMessage("This callback has no pending connection. Close this window and use the Connect button in the app.");
      setTimeout(() => window.close(), 3000);
      return;
    }

    const finalize = async () => {
      try {
        setMessage("Finalizing connection…");
        const result = await social<FinalizeResult>("connect.finalize", { platform, code, state });

        // LinkedIn: show the "post as" picker (personal first, then Company Pages).
        if (platform === "linkedin" && result.organizations?.length) {
          setPendingResult(result);
          setStatus("success");
          setMessage("Choose where to post from:");
          return;
        }

        // Meta: auto-select a single page; show the picker for multiple.
        if (platform === "meta" && result.pages) {
          if (result.pages.length === 1) {
            const page = result.pages[0];
            await selectAndFinish(result, {
              platform: "meta",
              agency_id: result.agency_id,
              pageId: page.id,
              pageName: page.name,
              pageAccessToken: page.access_token,
            });
            return;
          }
          setPendingResult(result);
          setStatus("success");
          setMessage("Choose which Facebook Page to publish to:");
          return;
        }

        finish(result);
      } catch (err) {
        const msg = (err as Error).message || "Unexpected error during connection.";
        setStatus("error");
        setMessage(msg);
        notifyOpener({ [POST_ERROR]: msg });
      }
    };

    finalize();
  }, [searchParams, platform]);

  const renderPicker = () => {
    if (!pendingResult) return null;
    if (platform === "linkedin") {
      return (
        <div className="w-full space-y-2">
          <button
            onClick={() => selectAndFinish(pendingResult, { platform: "linkedin", agency_id: pendingResult.agency_id, organization_urn: null, organization_name: null })}
            disabled={selecting}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-50 text-left"
          >
            <User className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground">Personal profile ({pendingResult.displayName || "you"})</span>
          </button>
          {pendingResult.organizations!.map((org) => (
            <button
              key={org.urn}
              onClick={() => selectAndFinish(pendingResult, { platform: "linkedin", agency_id: pendingResult.agency_id, organization_urn: org.urn, organization_name: org.name })}
              disabled={selecting}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-50 text-left"
            >
              <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-semibold text-foreground">{org.name}</span>
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="w-full space-y-2">
        {pendingResult.pages!.map((page) => (
          <button
            key={page.id}
            onClick={() => selectAndFinish(pendingResult, {
              platform: "meta",
              agency_id: pendingResult.agency_id,
              pageId: page.id,
              pageName: page.name,
              pageAccessToken: page.access_token,
            })}
            disabled={selecting}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-50 text-left"
          >
            <Globe className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground">{page.name}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0D1526] flex items-center justify-center">
      <div className="bg-card dark:bg-[#111E33] rounded-2xl border border-border dark:border-white/10 p-10 flex flex-col items-center text-center gap-4 w-full max-w-sm">
        {status === "loading" && (
          <>
            <div className="w-14 h-14 rounded-xl bg-[#0078D7]/15 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-[#0078D7] animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground dark:text-[#EEF1FA] mb-1">Connecting {platformName}</p>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-14 h-14 rounded-xl bg-[#22C55E]/15 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#22C55E]" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground dark:text-[#EEF1FA] mb-1">Connected!</p>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
            {pendingResult && (
              <div className="w-full">
                {renderPicker()}
                {selecting && <p className="text-[11px] text-muted-foreground mt-2"><Loader2 className="w-3 h-3 inline animate-spin mr-1" />Saving…</p>}
              </div>
            )}
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-14 h-14 rounded-xl bg-red-500/15 flex items-center justify-center">
              <Icon className={`w-7 h-7 ${color}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground dark:text-[#EEF1FA] mb-1">Connection Failed</p>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
