import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function GbpCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Exchanging authorization code…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      const msg = error === "access_denied"
        ? "Google denied access. Make sure this Google account manages the GBP listing."
        : `Google error: ${error}`;
      setStatus("error");
      setMessage(msg);
      setTimeout(() => navigate(`/gbp?error=${encodeURIComponent(error)}`), 2500);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received.");
      setTimeout(() => navigate("/gbp?error=no_code"), 2500);
      return;
    }

    // redirectUri must match what was sent to Google in gbp-auth-url (the frontend callback URL)
    const redirectUri = `${window.location.origin}/gbp/callback`;

    const exchange = async () => {
      try {
        setMessage("Connecting to Google Business Profile…");

        const { data, error: fnError } = await supabase.functions.invoke("gbp-auth-callback", {
          body: { code, state: state || "", redirectUri },
        });

        if (fnError) {
          setStatus("error");
          setMessage(fnError.message || "Connection failed.");
          setTimeout(() => navigate(`/gbp?error=${encodeURIComponent(fnError.message || "exchange_failed")}`), 2500);
          return;
        }

        if (data?.success) {
          setStatus("success");
          setMessage(`${data.businessName} connected with ${data.reviewCount || 0} reviews`);

          if (data.crmClientId) {
            // Agency-initiated: go back to the CRM client page
            setTimeout(() => navigate(
              `/dashboard/crm/clients/${data.crmClientId}?gbp=connected&business=${encodeURIComponent(data.businessName || "")}`
            ), 1500);
          } else if (data.linkUserId && data.connectionId) {
            // Portal self-connect
            setTimeout(() => navigate(`/portal/${data.connectionId}?status=connected`), 1500);
          } else {
            // Standalone GBP page
            setTimeout(() => navigate(
              `/gbp?status=connected&business=${encodeURIComponent(data.businessName || "")}`
            ), 1500);
          }
        } else {
          setStatus("error");
          setMessage(data?.error || "Connection failed.");
          setTimeout(() => navigate(`/gbp?error=${encodeURIComponent(data?.error || "exchange_failed")}`), 2500);
        }
      } catch (err) {
        setStatus("error");
        setMessage("Unexpected error during connection.");
        setTimeout(() => navigate("/gbp?error=unexpected"), 2500);
      }
    };

    exchange();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#0D1526] flex items-center justify-center">
      <div className="bg-card dark:bg-[#111E33] rounded-2xl border border-border dark:border-white/10 p-10 flex flex-col items-center text-center gap-4 w-full max-w-sm">
        {status === "loading" && (
          <>
            <div className="w-14 h-14 rounded-xl bg-[#0078D7]/15 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-[#0078D7] animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground dark:text-[#EEF1FA] mb-1">Connecting Profile</p>
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
