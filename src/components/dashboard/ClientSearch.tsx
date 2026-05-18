import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Store, MapPin, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface ClientResult {
  id: string;
  client_label: string;
  business_name: string | null;
  address: string | null;
  category: string | null;
}

export function ClientSearch() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const q = `*${query.trim()}*`;
      const { data, error } = await supabase
        .from("gbp_connections")
        .select("id,client_label,business_name,address,category")
        .or(`client_label.ilike.${q},business_name.ilike.${q},address.ilike.${q},category.ilike.${q}`)
        .limit(8);
      if (error) console.error("Search error:", error);
      setResults((data as ClientResult[]) || []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (id: string) => {
    setOpen(false);
    setQuery("");
    navigate(`/gbp?focus=${id}`);
  };

  return (
    <div ref={wrapRef} className="relative hidden sm:block">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 w-64 border transition-colors",
          isDark
            ? "bg-muted/60 dark:bg-white/5 border-border dark:border-white/10 focus-within:border-[#0078D7]/50"
            : "bg-muted border-border focus-within:border-primary/50",
        )}
      >
        <Search className={cn("w-3.5 h-3.5 flex-shrink-0", isDark ? "text-muted-foreground" : "text-muted-foreground")} />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search clients (GBP)..."
          className={cn(
            "flex-1 bg-transparent border-0 outline-none text-xs",
            isDark
              ? "text-foreground dark:text-[#EEF1FA] placeholder:text-muted-foreground"
              : "text-foreground placeholder:text-muted-foreground",
          )}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); }}
            className={cn(isDark ? "text-muted-foreground hover:text-foreground dark:text-[#EEF1FA]" : "text-muted-foreground hover:text-foreground")}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && query && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              "absolute top-full mt-1.5 left-0 right-0 rounded-xl shadow-2xl overflow-hidden z-50 border",
              isDark
                ? "bg-card dark:bg-[#111E33] border-border dark:border-white/10"
                : "bg-popover border-border",
            )}
          >
            {loading && (
              <div className={cn("flex items-center gap-2 px-4 py-3 text-xs", isDark ? "text-muted-foreground" : "text-muted-foreground")}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Searching connected profiles...
              </div>
            )}

            {!loading && results.length === 0 && (
              <div className="px-4 py-4 text-center">
                <p className={cn("text-xs mb-2", isDark ? "text-muted-foreground" : "text-muted-foreground")}>
                  No matching clients found
                </p>
                <button
                  onClick={() => { setOpen(false); setQuery(""); navigate("/gbp"); }}
                  className="text-[10px] font-bold text-[#0078D7] hover:underline"
                >
                  + Connect a new GBP profile
                </button>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="max-h-80 overflow-auto">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r.id)}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 transition-colors text-left last:border-b-0",
                      isDark
                        ? "hover:bg-muted/60 dark:bg-white/5 border-b border-border dark:border-white/5"
                        : "hover:bg-muted border-b border-border",
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#0078D7]/15 flex items-center justify-center flex-shrink-0">
                      <Store className="w-4 h-4 text-[#0078D7]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-xs font-bold truncate", isDark ? "text-foreground dark:text-[#EEF1FA]" : "text-foreground")}>
                          {r.business_name || r.client_label}
                        </span>
                        {r.category && (
                          <span className="text-[9px] font-bold bg-[#0078D7]/15 text-[#0078D7] px-1.5 py-0.5 rounded-full">
                            {r.category}
                          </span>
                        )}
                      </div>
                      {r.address && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className={cn("w-2.5 h-2.5", isDark ? "text-muted-foreground" : "text-muted-foreground")} />
                          <span className={cn("text-[10px] truncate", isDark ? "text-muted-foreground" : "text-muted-foreground")}>
                            {r.address}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className={cn("px-3 py-2 border-t", isDark ? "border-border dark:border-white/5 bg-muted/20 dark:bg-white/2" : "border-border bg-muted/50")}>
              <p className={cn("text-[9px] text-center", isDark ? "text-muted-foreground" : "text-muted-foreground")}>
                Searches connected Google Business Profiles
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
