import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Landing page for the click-tracking links in review-request emails
// (dashboard.citywidedigital.ca/r?tok=...&p=...&u=...).
// The function gateway requires an Authorization header, which a plain link from
// an email cannot carry — so the click routes through this SPA page, which calls
// the review-click backend function (recording the click) and then redirects the
// customer to the review page.
export function ReviewClickRedirect() {
  const [searchParams] = useSearchParams();
  const [failed, setFailed] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const token = searchParams.get("tok") ?? "";
    const platform = searchParams.get("p") ?? "google";
    const dest = searchParams.get("u");

    if (done.current) return;
    done.current = true;

    (async () => {
      // Record the click (best-effort — never blocks the redirect).
      try {
        if (token) {
          await supabase.functions.invoke("review-click", { body: { token, platform } });
        }
      } catch {
        // ignore — tracking must never block the customer.
      }

      const target = dest || "https://www.google.com/search?q=leave+a+review";
      if (/^https?:\/\//i.test(target)) {
        window.location.replace(target);
        return;
      }
      setFailed(true);
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#0A1120] flex flex-col items-center justify-center gap-4 px-6">
      {failed ? (
        <>
          <p className="text-sm text-muted-foreground text-center">
            This review link is no longer valid.
          </p>
          <a
            href="https://www.google.com/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0078D7] hover:bg-[#005FA3] text-white transition-colors"
          >
            Go to Google
          </a>
        </>
      ) : (
        <>
          <Loader2 className="w-6 h-6 text-[#0078D7] animate-spin" />
          <p className="text-sm text-muted-foreground">Taking you to leave a review…</p>
        </>
      )}
    </div>
  );
}
