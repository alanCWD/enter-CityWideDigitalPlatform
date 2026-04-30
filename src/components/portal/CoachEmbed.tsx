import { useState } from "react";
import { Loader2, AlertCircle, GraduationCap } from "lucide-react";

/**
 * GSO Coach iframe embed.
 *
 * Each client gets their own coach workspace, scoped via ?clientId.
 * Edit COACH_URL once you've deployed the GSO Coach project.
 */
const COACH_URL = "https://YOUR-GSO-COACH-URL.enter.pro";

interface CoachEmbedProps {
  clientId: string;
  clientName?: string;
}

export function CoachEmbed({ clientId, clientName }: CoachEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const isPlaceholder = COACH_URL.includes("YOUR-GSO-COACH-URL");
  const src = `${COACH_URL}/?clientId=${encodeURIComponent(clientId)}`;

  if (isPlaceholder) {
    return (
      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/8 p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-bold text-yellow-400 mb-1">GSO Coach URL not configured</p>
          <p className="text-[11px] text-[rgba(238,241,250,0.6)] leading-relaxed">
            Deploy the GSO Coach project, then edit{" "}
            <code className="bg-white/10 px-1 py-0.5 rounded text-[10px]">COACH_URL</code> in{" "}
            <code className="bg-white/10 px-1 py-0.5 rounded text-[10px]">
              src/components/portal/CoachEmbed.tsx
            </code>
            .
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
      <div className="flex items-center gap-2">
        <GraduationCap className="w-3.5 h-3.5 text-[#0078D7]" />
        <span className="text-xs font-bold text-[#EEF1FA]">GSO Coach</span>
        {clientName && (
          <span className="text-[10px] text-[rgba(238,241,250,0.4)]">· {clientName}</span>
        )}
      </div>
      <div
        className="relative rounded-xl overflow-hidden border border-white/8 bg-[#0A1120]"
        style={{ minHeight: 700 }}
      >
        {!loaded && !errored && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-[rgba(238,241,250,0.5)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading coach...
          </div>
        )}
        {errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-xs font-bold text-red-400">Could not load Coach</p>
          </div>
        )}
        <iframe
          src={src}
          width="100%"
          height="100%"
          style={{ border: "none", minHeight: 700, display: "block" }}
          title="GSO Coach"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      </div>
    </div>
  );
}
