import { useState } from "react";
import { Loader2, Share2, AlertCircle } from "lucide-react";

/**
 * Social Sync iframe embed.
 *
 * Each connected client gets their own isolated Social Sync workspace,
 * scoped by the GBP connection id passed via the ?clientId query param.
 *
 * To point at your real deployed Social Sync project, edit SOCIAL_SYNC_URL.
 */
const SOCIAL_SYNC_URL = "https://YOUR-SOCIAL-SYNC-URL.enter.pro";

interface SocialSyncEmbedProps {
  /** Stable per-client identifier (the gbp_connections row id). */
  clientId: string;
  /** Optional friendly business name shown above the iframe. */
  clientName?: string;
}

export function SocialSyncEmbed({ clientId, clientName }: SocialSyncEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const isPlaceholder = SOCIAL_SYNC_URL.includes("YOUR-SOCIAL-SYNC-URL");
  const src = `${SOCIAL_SYNC_URL}/?clientId=${encodeURIComponent(clientId)}`;

  if (isPlaceholder) {
    return (
      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/8 p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-bold text-yellow-400 mb-1">Social Sync URL not configured</p>
          <p className="text-[11px] text-[rgba(238,241,250,0.6)] leading-relaxed">
            Deploy the Social Sync project, then edit <code className="bg-white/10 px-1 py-0.5 rounded text-[10px]">SOCIAL_SYNC_URL</code>
            {" "}in <code className="bg-white/10 px-1 py-0.5 rounded text-[10px]">src/components/dashboard/SocialSyncEmbed.tsx</code> with the real URL.
          </p>
          <p className="text-[10px] text-[rgba(238,241,250,0.4)] mt-2">
            Will load: <span className="font-mono">{src}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="w-3.5 h-3.5 text-[#0078D7]" />
          <span className="text-xs font-bold text-[#EEF1FA]">Social Sync</span>
          {clientName && (
            <span className="text-[10px] text-[rgba(238,241,250,0.4)]">· {clientName}</span>
          )}
        </div>
        <span className="text-[9px] font-bold bg-[#0078D7]/15 text-[#0078D7] px-1.5 py-0.5 rounded-full">
          Workspace: {clientId.slice(0, 8)}
        </span>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-white/8 bg-[#0A1120]" style={{ minHeight: 700 }}>
        {!loaded && !errored && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-[rgba(238,241,250,0.5)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading Social Sync workspace...
          </div>
        )}
        {errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-xs font-bold text-red-400">Could not load Social Sync</p>
            <p className="text-[10px] text-[rgba(238,241,250,0.5)] max-w-sm">
              The embedded app refused to load. Make sure the Social Sync project allows iframe embedding from this origin (CORS / X-Frame-Options).
            </p>
          </div>
        )}
        <iframe
          src={src}
          width="100%"
          height="100%"
          style={{ border: "none", minHeight: 700, display: "block" }}
          title="Social Sync Pro"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      </div>
    </div>
  );
}
