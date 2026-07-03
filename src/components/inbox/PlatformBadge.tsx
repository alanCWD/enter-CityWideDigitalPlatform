import { cn } from "@/lib/utils";

const PLATFORMS: Record<string, { label: string; className: string }> = {
  whatsapp:  { label: "WA",  className: "bg-green-500/20 text-green-600 dark:text-green-400" },
  instagram: { label: "IG",  className: "bg-purple-500/20 text-purple-600 dark:text-purple-400" },
  messenger: { label: "MG",  className: "bg-blue-500/20 text-blue-600 dark:text-blue-400" },
  telegram:  { label: "TG",  className: "bg-sky-500/20 text-sky-600 dark:text-sky-400" },
  twitter:   { label: "X",   className: "bg-slate-500/20 text-slate-600 dark:text-slate-300" },
  reddit:    { label: "RD",  className: "bg-orange-500/20 text-orange-600 dark:text-orange-400" },
  bluesky:   { label: "BSK", className: "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400" },
};

interface PlatformBadgeProps {
  platform: string;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const p = PLATFORMS[platform.toLowerCase()] ?? {
    label: platform.slice(0, 2).toUpperCase(),
    className: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded px-1 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide",
        p.className,
        className,
      )}
    >
      {p.label}
    </span>
  );
}
