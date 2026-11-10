import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Fire-and-forget diagnostic log so we can see exactly where the OAuth flow
// broke down, even if the client closes the tab before the exchange finishes
// or a browser extension blocks the follow-up request.
function logAttempt(stage: string, crmClientId: string | null, realmId: string | null, message?: string) {
  try {
    supabase.functions.invoke("qbo-log-attempt", {
      body: { stage, crmClientId, realmId, message },
    });
  } catch {
    // Never let logging break the actual flow
  }
}

export function QboCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting to QuickBooks Online…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const realmId = searchParams.get("realmId");
    const error = searchParams.get("error");

    const getCrmId = () => {
      if (!state) return null;
      try { return JSON.parse(atob(state)).crmClientId ?? null; } catch { return null; }
    };
    const crmClientId = getCrmId();

    logAttempt("landed", crmClientId, realmId, `url=${window.location.href}`);

    if (error) {
      setStatus("error");
      setMessage(`QuickBooks error: ${error}`);
      logAttempt("error_param", crmClientId, realmId, error);
      return;
    }

    if (!code || !realmId) {
      setStatus("error");
      setMessage("Missing authorization code or company ID.");
      logAttempt("no_code", crmClientId, realmId);
      return;
    }

    const redirectUri = `${window.location.origin}/qbo/callback`;

    const exchange = async () => {
      try {
        setMessage("Exchanging authorization code…");
        logAttempt("callback_invoking", crmClientId, realmId);

        const { data, error: fnError } = await supabase.functions.invoke("qbo-auth-callback", {
          body: { code, state: state || "", realmId, redirectUri },
        });

        if (fnError) {
          let msg = "Connection failed.";
          try {
            const body = await (fnError as unknown as { context: Response }).context?.json?.();
            msg = body?.error || fnError.message || msg;
          } catch { msg = fnError.message || msg; }
          setStatus("error");
          setMessage(msg);
          logAttempt("callback_error", crmClientId, realmId, msg);
          return;
        }

        // Only claim success when the saved connection is actually active —
        // the token exchange can succeed while the stored connection stays broken.
        const isActive = data?.status ? data.status === "active" : !!data?.success;

        if (data?.success && isActive) {
          setStatus("success");
          setMessage("QuickBooks Online connected! Review requests are now active. You can close this window.");
          logAttempt("success", crmClientId, realmId);
        } else {
          setStatus("error");
          setMessage(data?.error || "The connection could not be saved. Please ask for a new connection link.");
          logAttempt("callback_failed", crmClientId, realmId, data?.error || `status=${data?.status ?? "unknown"}`);
        }
      } catch (e) {
        setStatus("error");
        setMessage("Unexpected error during connection.");
        logAttempt("exception", crmClientId, realmId, (e as Error).message);
      }
    };

    exchange();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#0D1526] flex items-center justify-center">
      <div className="bg-card dark:bg-[#111E33] rounded-2xl border border-border dark:border-white/10 p-10 flex flex-col items-center text-center gap-4 w-full max-w-sm">
        {status === "loading" && (
          <>
            <div className="w-14 h-14 rounded-xl bg-[#2CA01C]/15 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-[#2CA01C] animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground dark:text-[#EEF1FA] mb-1">Connecting QuickBooks</p>
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
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-14 h-14 rounded-xl bg-red-500/15 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-400" />
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
