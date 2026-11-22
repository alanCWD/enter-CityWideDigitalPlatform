import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { LaunchResultBanner } from "@/components/apps/LaunchResultBanner";
import { launchResultMessage } from "@/lib/apps";

/**
 * Where Inbox Pro returns someone whose handoff it refused. The reason comes
 * back as `code` (or `error`), never as part of the token.
 */
export function LaunchResult() {
  const [params] = useSearchParams();
  const code = params.get("code") ?? params.get("error") ?? params.get("launch_error");

  return (
    <DashboardLayout>
      <TopBar title="Inbox Pro sign-in" subtitle="The handoff did not complete" />
      <div className="px-6 py-6 space-y-4">
        {code ? (
          <LaunchResultBanner code={code} />
        ) : (
          <div className="rounded-2xl border border-border dark:border-white/10 bg-card dark:bg-[#111E33] p-4">
            <p className="text-sm font-bold text-foreground">No launch result was provided</p>
            <p className="text-xs text-muted-foreground mt-1">{launchResultMessage(null)}</p>
            <Link
              to="/dashboard/crm/apps"
              className="mt-3 inline-flex items-center gap-1.5 bg-transparent hover:bg-accent text-foreground text-xs font-bold px-3 py-2 rounded-lg border border-border dark:border-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to apps
            </Link>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Launching again issues a fresh single-use link. If Inbox Pro keeps refusing, check the
          workspace address, its paused state and its seat count before retrying.
        </p>
      </div>
    </DashboardLayout>
  );
}
