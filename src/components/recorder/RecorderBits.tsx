import { useState } from "react";
import { Check, Copy, Link2, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StatusPill({ status, label }: { status: "ok" | "failed" | "idle" | "partial"; label?: string }) {
  const tone = status === "ok"
    ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#16A34A] dark:text-[#4ADE80]"
    : status === "failed"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : status === "partial"
        ? "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#B45309] dark:text-[#FBBF24]"
        : "border-border bg-muted/40 text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", tone)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "ok" ? "bg-[#22C55E]" : status === "failed" ? "bg-destructive" : status === "partial" ? "bg-[#F59E0B]" : "bg-muted-foreground/50")} />
      {label ?? (status === "ok" ? "Synced" : status === "failed" ? "Failed" : status === "partial" ? "Partial" : "Not synced")}
    </span>
  );
}

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 px-2.5 text-[11px]", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard unavailable */ }
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function CustomerLink({ url, qr, slug }: { url: string | null; qr: string | null; slug?: string | null }) {
  if (!url && !qr) {
    return <span className="text-[11px] text-muted-foreground">Link appears after the first successful push.</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {url && (
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-[11px]">
          <a href={url} target="_blank" rel="noreferrer">
            <Link2 className="h-3 w-3" /> Customer page
          </a>
        </Button>
      )}
      {qr && (
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-[11px]">
          <a href={qr} target="_blank" rel="noreferrer" download>
            <QrCode className="h-3 w-3" /> QR code
          </a>
        </Button>
      )}
      {slug && <code className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">/{slug}</code>}
    </div>
  );
}

export function InlineLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {message}
    </p>
  );
}
