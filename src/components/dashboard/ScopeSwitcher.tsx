import { useCallback, useEffect, useRef, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { Building2, ChevronDown, Loader2, Search, Store, UserRound, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { crm, type CrmClient } from "@/lib/crm";
import { cn } from "@/lib/utils";

/**
 * Shows which scope the workspace is in: the agency book, or one client.
 *
 * Super admins can jump straight to any client. Staff see the indicator too;
 * client users never see the switcher at all.
 */
export function ScopeSwitcher() {
  const { user } = useAuth();
  const { isAgency, isSuperAdmin, loading: roleLoading } = useUserRole(user?.id);
  const match = useMatch("/dashboard/crm/clients/:id");
  const activeClientId = match?.params.id ?? null;
  const navigate = useNavigate();

  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crm<{ clients: CrmClient[] }>("clients.list", { limit: 200 });
      setClients(data.clients ?? []);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // The switcher is a super-admin tool; nobody else needs the full book.
  useEffect(() => {
    if (!isSuperAdmin) return;
    void loadClients();
  }, [isSuperAdmin, loadClients]);

  // Name the client we are currently inside, even when the book is not loaded.
  useEffect(() => {
    if (!activeClientId) { setActiveName(null); return; }
    const known = clients.find((c) => c.id === activeClientId);
    if (known) { setActiveName(known.name); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await crm<{ client: CrmClient }>("clients.get", { id: activeClientId });
        if (!cancelled) setActiveName(data.client?.name ?? null);
      } catch {
        if (!cancelled) setActiveName(null);
      }
    })();
    return () => { cancelled = true; };
  }, [activeClientId, clients]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (roleLoading || !isAgency) return null;

  const filtered = query.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : clients;

  const goToClient = (id: string) => {
    setOpen(false);
    setQuery("");
    navigate(`/dashboard/crm/clients/${id}?tab=apps`);
  };

  if (activeClientId) {
    return (
      <div className="flex items-center gap-1.5 rounded-xl border border-[#0078D7]/30 bg-[#0078D7]/10 px-2.5 py-1.5">
        <UserRound className="w-3.5 h-3.5 text-[#0078D7] flex-shrink-0" />
        <span className="text-[11px] font-semibold text-foreground dark:text-[#EEF1FA] truncate max-w-[160px]">
          Client: {activeName ?? "Loading…"}
        </span>
        <button
          type="button"
          onClick={() => navigate("/dashboard/crm/apps")}
          className="ml-1 text-[10px] font-bold uppercase tracking-wider text-[#0078D7] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          Agency view
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-foreground dark:text-[#EEF1FA] hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Building2 className="w-3.5 h-3.5 text-[#0078D7]" />
        Viewing as: Agency
        {isSuperAdmin && (
          <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && isSuperAdmin && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#111E33] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Switch to a client…"
              aria-label="Switch to a client"
              className="flex-1 bg-transparent text-xs text-foreground dark:text-[#EEF1FA] placeholder:text-muted-foreground outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-auto p-1.5">
            {loading && (
              <p className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading clients…
              </p>
            )}
            {!loading && loadError && (
              <div className="px-3 py-2">
                <p className="text-[11px] text-destructive break-words">Could not load clients: {loadError}</p>
                <button
                  type="button"
                  onClick={() => void loadClients()}
                  className="mt-2 text-[10px] font-bold text-[#0078D7] hover:underline"
                >
                  Try again
                </button>
              </div>
            )}
            {!loading && !loadError && filtered.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">No clients match.</p>
            )}
            {!loading && !loadError && filtered.map((client) => (
              <button
                key={client.id}
                type="button"
                role="menuitem"
                onClick={() => goToClient(client.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-foreground dark:text-[#EEF1FA] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Store className="w-3.5 h-3.5 flex-shrink-0 text-[#0078D7]" />
                <span className="flex-1 truncate">{client.name}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  {client.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
