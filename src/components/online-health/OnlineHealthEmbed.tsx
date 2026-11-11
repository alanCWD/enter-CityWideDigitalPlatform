import { useEffect, useState } from "react";
import { AlertCircle, ExternalLink, HeartPulse, Loader2 } from "lucide-react";
import { buildOnlineHealthUrl } from "@/lib/onlineHealth";

interface OnlineHealthEmbedProps {
  /** Stable portal connection id — the key for the slug mapping. */
  connectionId: string | null | undefined;
  /** Friendly name, used in the notice copy and the frame title. */
  clientName?: string | null;
}

/**
 * Container for the Business Online Health module.
 *
 * Renders the module's embedded layout (`embed=1`) so its own sidebar, top bar
 * and footer stay out of the way. We add no header of our own above the frame:
 * the module's slim bar carries the client, location, check date and the way
 * back, and the surrounding dashboard keeps its own navigation.
 *
 * The module is read-only. Nothing here edits a listing, site, DNS record or
 * email, and no plan or coverage value from the module is treated as truth.
 */
export function OnlineHealthEmbed({ connectionId, clientName }: OnlineHealthEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const url = buildOnlineHealthUrl(connectionId, { embed: true });

  // A frame blocked from loading does not always fire onError, so stop showing
  // the loading panel indefinitely and offer the new-tab fallback instead.
  useEffect(() => {
    if (loaded || failed || !url) return;
    const timer = setTimeout(() => setFailed(true), 20_000);
    return () => clearTimeout(timer);
  }, [loaded, failed, url]);

  if (!url) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-6">
        <div className="flex items-start gap-3">
          <HeartPulse className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-foreground">Online Health isn't set up for this client yet</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
              {clientName
                ? `${clientName} needs a business profile and a client reference before the report can open.`
                : "This client needs a business profile and a client reference before the report can open."}{" "}
              Ask CityWide Digital to add the client reference — no other client's report is shown in the meantime.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-border bg-muted/20"
      style={{ minHeight: 900 }}
    >
      {!loaded && !failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading Online Health…
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <div>
            <p className="text-sm font-bold text-foreground">We couldn't load the Online Health report</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              The report may be temporarily unavailable or blocked from loading here. You can open it in its own tab.
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:border-primary/40 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open report in a new tab
          </a>
        </div>
      )}

      <iframe
        src={url}
        title={clientName ? `Business Online Health — ${clientName}` : "Business Online Health"}
        allow="clipboard-write"
        onLoad={() => {
          setLoaded(true);
          setFailed(false);
        }}
        onError={() => setFailed(true)}
        className="block w-full border-0"
        style={{ minHeight: 900, height: "calc(100vh - 8rem)" }}
      />
    </div>
  );
}
