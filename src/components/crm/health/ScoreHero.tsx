import { BUCKET_COLOR, type HealthBucket } from "@/lib/health";

interface Props {
  score: number;
  bucket: HealthBucket;
  label: string;
  totalChecks: number;
  passCount: number;
  failCount: number;
}

export function ScoreHero({ score, bucket, label, totalChecks, passCount, failCount }: Props) {
  const color = BUCKET_COLOR[bucket];
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="bg-[#0D1526] border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6">
      <div className="relative shrink-0 self-center" style={{ width: 168, height: 168 }}>
        <svg width={168} height={168} viewBox="0 0 168 168" className="-rotate-90">
          <circle cx={84} cy={84} r={radius} fill="none" stroke="rgba(238,241,250,0.08)" strokeWidth={12} />
          <circle
            cx={84}
            cy={84}
            r={radius}
            fill="none"
            stroke={color.bg}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-extrabold text-[#EEF1FA] leading-none">{score}</div>
          <div className="text-[10px] uppercase tracking-wider text-[rgba(238,241,250,0.5)] font-bold mt-1">/ 100</div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2"
          style={{ backgroundColor: color.soft, color: color.bg }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.bg }} />
          {label}
        </div>
        <h2 className="text-lg font-extrabold text-[#EEF1FA] leading-tight">Digital Presence Health</h2>
        <p className="text-sm text-[rgba(238,241,250,0.65)] mt-1">
          Weighted score across {totalChecks} checks — covers website, GBP, citations, performance, and operational readiness.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 max-w-md">
          <Stat label="Passing" value={passCount} color="#22C55E" />
          <Stat label="Needs work" value={Math.max(0, totalChecks - passCount - failCount)} color="#F97316" />
          <Stat label="Failing" value={failCount} color="#EF4444" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#111E33] border border-white/10 rounded-xl px-3 py-2.5">
      <div className="text-2xl font-extrabold leading-none" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[rgba(238,241,250,0.55)] font-bold mt-1">{label}</div>
    </div>
  );
}
