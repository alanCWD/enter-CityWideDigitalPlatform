import { useVault } from "@/hooks/useVault";
import { NotesSection } from "./NotesSection";
import { CredentialsSection } from "./CredentialsSection";
import { FilesSection } from "./FilesSection";
import { Loader2, ShieldAlert } from "lucide-react";

interface Props {
  clientId: string;
}

export function VaultPanel({ clientId }: Props) {
  const { notes, credentials, files, loading, error, reload } = useVault(clientId);

  if (loading && notes.length === 0 && credentials.length === 0 && files.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[rgba(238,241,250,0.6)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading vault…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 text-sm text-red-300 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-bold">Vault failed to load</p>
          <p className="text-xs opacity-80 mt-1">{error}</p>
          <button onClick={reload} className="mt-2 text-xs font-bold underline">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="bg-[#0D1526] border border-white/10 rounded-2xl px-5 py-4">
        <h2 className="text-base font-bold text-[#EEF1FA]">Client Vault</h2>
        <p className="text-xs text-[rgba(238,241,250,0.6)] mt-1">
          Internal notes, login credentials, and files for this client. Items marked
          <span className="mx-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#22C55E]/15 text-[#22C55E]">Shared</span>
          appear in the client portal; everything else stays inside the agency.
        </p>
      </header>

      <NotesSection clientId={clientId} notes={notes} onChange={reload} />
      <CredentialsSection clientId={clientId} credentials={credentials} onChange={reload} />
      <FilesSection clientId={clientId} files={files} onChange={reload} />
    </div>
  );
}
