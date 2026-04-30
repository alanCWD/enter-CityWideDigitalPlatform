import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

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
      setStatus("error");
      setMessage(`Google denied access: ${error}`);
      setTimeout(() => navigate(`/gbp?error=${encodeURIComponent(error)}`), 2500);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received.");
      setTimeout(() => navigate("/gbp?error=no_code"), 2500);
      return;
    }

    // Parse client label + redirectUri from state
    let clientLabel = "New Client";
    let linkUserId: string | null = null;
    // The redirectUri must exactly match what was sent to Google in the auth URL
    const redirectUri = window.location.href.split("?")[0]; // current URL without query params
    try {
      const parsed = JSON.parse(atob(state || ""));
      clientLabel = parsed.clientLabel || clientLabel;
      linkUserId = parsed.linkUserId || null;
    } catch { /* use default */ }

    // Exchange code via edge function (with proper auth headers)
    const exchange = async () => {
      try {
        setMessage("Connecting to Google Business Profile…");
        const res = await fetch(`${SUPABASE_URL}/functions/v1/gbp-auth-callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            code,
            clientLabel,
            redirectUri,
            linkUserId,
          }),
        });

        const data = await res.json();

        if (data.diagnostics) {
          console.log("[GBP Diagnostics]", JSON.stringify(data.diagnostics, null, 2));
        }

        if (data.success) {
          const hasLocation = !!data.diagnostics?.resolvedLocationId;
          setStatus("success");
          setMessage(hasLocation
            ? `${data.businessName} connected with ${data.reviewCount || 0} reviews`
            : `${data.businessName} connected (no GBP location found on this account)`
          );
          // Portal self-connect → bounce back to the new business in the portal
          if (linkUserId && data.connectionId) {
            setTimeout(() => navigate(`/portal/${data.connectionId}?status=connected`), 1500);
          } else {
            setTimeout(() => navigate(`/gbp?status=connected&business=${encodeURIComponent(data.businessName || clientLabel)}&noLocation=${hasLocation ? "0" : "1"}`), 2000);
          }
        } else {
          setStatus("error");
          setMessage(data.error || "Connection failed.");
          setTimeout(() => navigate(`/gbp?error=${encodeURIComponent(data.error || "exchange_failed")}`), 2500);
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
      <div className="bg-[#111E33] rounded-2xl border border-white/10 p-10 flex flex-col items-center text-center gap-4 w-full max-w-sm">
        {status === "loading" && (
          <>
            <div className="w-14 h-14 rounded-xl bg-[#0078D7]/15 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-[#0078D7] animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#EEF1FA] mb-1">Connecting Profile</p>
              <p className="text-xs text-[rgba(238,241,250,0.5)]">{message}</p>
            </div>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-14 h-14 rounded-xl bg-[#22C55E]/15 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#22C55E]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#EEF1FA] mb-1">Connected!</p>
              <p className="text-xs text-[rgba(238,241,250,0.5)]">{message}</p>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-14 h-14 rounded-xl bg-red-500/15 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#EEF1FA] mb-1">Connection Failed</p>
              <p className="text-xs text-[rgba(238,241,250,0.5)]">{message}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
