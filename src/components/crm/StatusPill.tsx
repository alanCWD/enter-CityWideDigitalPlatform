import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  active:        "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  trialing:      "bg-[#5BB8FF]/15 text-[#5BB8FF] border-[#5BB8FF]/30",
  paused:        "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  past_due:      "bg-orange-500/15 text-orange-300 border-orange-500/30",
  canceled:      "bg-white/10 text-[rgba(238,241,250,0.55)] border-white/15",
  churned:       "bg-white/10 text-[rgba(238,241,250,0.55)] border-white/15",
  lead:          "bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30",
  prospect:      "bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30",
  draft:         "bg-white/10 text-[rgba(238,241,250,0.55)] border-white/15",
  open:          "bg-[#5BB8FF]/15 text-[#5BB8FF] border-[#5BB8FF]/30",
  paid:          "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  void:          "bg-white/10 text-[rgba(238,241,250,0.45)] border-white/15",
  uncollectible: "bg-red-500/15 text-red-300 border-red-500/30",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const style = STYLES[status] ?? "bg-white/10 text-[rgba(238,241,250,0.6)] border-white/15";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
        style,
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
