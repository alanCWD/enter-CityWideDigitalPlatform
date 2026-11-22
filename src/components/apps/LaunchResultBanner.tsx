import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { launchResultMessage } from "@/lib/apps";

/**
 * What Inbox Pro said when it refused a handoff. Used both on its own result
 * page and inline on the Apps directory, so a return to either address is
 * understood.
 */
export function LaunchResultBanner({
  code,
  onDismiss,
}: {
  code: string | null;
  onDismiss?: () => void;
}) {
  if (!code) return null;

  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-destructive">
            Inbox Pro did not sign you in
          </p>
          <p className="text-xs text-destructive/90 mt-1">{launchResultMessage(code)}</p>
          <p className="text-[11px] text-destructive/80 mt-1">
            Result code {code}. Nothing in Citywide was changed.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to="/dashboard/crm/apps"
          className="inline-flex items-center gap-1.5 bg-transparent hover:bg-destructive/10 text-destructive text-xs font-bold px-3 py-2 rounded-lg border border-destructive/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to apps
        </Link>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
