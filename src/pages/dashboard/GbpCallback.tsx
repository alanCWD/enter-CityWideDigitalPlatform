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

    // Parse client label from state
    let clientLabel = "New Client";
    try {
      const parsed = JSON.parse(atob(state || ""));
      clientLabel = parsed.clientLabel || clientLabel;
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
            origin: window.location.origin,
          }),
        });

        const data = await res.json();

        if (data.success) {
          setStatus("success");
          setMessage(`${data.businessName || clientLabel} connected!`);
          setTimeout(() => navigate(`/gbp?status=connected&business=${encodeURIComponent(data.businessName || clientLabel)}`), 1500);
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
