// Pushes the agency's active client book to the publishing engine.
//
// Deliberately not gated on this dashboard's own roles: publishing admin comes
// from the engine's `cw_agency_members` registry, a different thing entirely, so
// the engine decides and answers `admin_required` if the caller may not sync.
// Deciding it here would just hide the action from the people who do qualify.

import { useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isPartnerSocialError, syncBusinesses } from "@/lib/partner-social";
import { BOOK_LIMIT, readClientBook } from "./clientBook";

interface SyncBookButtonProps {
  agencySlug: string;
  onSynced: () => void;
}

export function SyncBookButton({ agencySlug, onSynced }: SyncBookButtonProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function sync() {
    const confirmed = window.confirm(
      `Push the complete active client list for "${agencySlug}" to the publishing engine?\n\n` +
        "The engine mirrors the whole book: any company missing from this list is " +
        "archived, never deleted.",
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const book = await readClientBook(agencySlug);

      if (book.overLimit) {
        toast({
          title: "Book too large to sync safely",
          description: `${book.total} active clients, and one sync carries at most ${BOOK_LIMIT}. A partial book would archive the rest, so nothing was sent.`,
          variant: "destructive",
        });
        return;
      }

      if (book.businesses.length === 0) {
        toast({
          title: "Nothing to sync",
          description: `No active clients in "${agencySlug}". An empty book is a no-op — nothing was archived.`,
        });
        return;
      }

      const result = await syncBusinesses({ agencyId: agencySlug, businesses: book.businesses });
      toast({
        title: "Client book synced",
        description: `${result.businesses.length} mirrored · ${result.archived} archived.`,
      });
      onSynced();
    } catch (e) {
      const code = isPartnerSocialError(e) ? e.code : "network_error";
      toast({
        title: code === "admin_required" ? "Admin role required" : "Sync failed",
        description:
          code === "admin_required"
            ? "Only an admin of that agency may push its client book."
            : (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={sync}>
      {busy ? <Loader2 className="animate-spin" /> : <Database />}
      {busy ? "Syncing…" : "Sync client book"}
    </Button>
  );
}
