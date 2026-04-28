import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Store, MapPin, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ClientResult {
  id: string;
  client_label: string;
  business_name: string | null;
  address: string | null;
  category: string | null;
}

export function ClientSearch() {
  const navigate = useNavigate();
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
      // PostgREST .or() filter uses * as wildcard (not %)
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
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 w-64 focus-within:border-[#0078D7]/50 transition-colors">
        <Search className="w-3.5 h-3.5 flex-shrink-0 text-[rgba(238,241,250,0.4)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search clients (GBP)..."
          className="flex-1 bg-transparent border-0 outline-none text-xs text-[#EEF1FA] placeholder:text-[rgba(238,241,250,0.4)]"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); }}
            className="text-[rgba(238,241,250,0.4)] hover:text-[#EEF1FA]"
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
            className="absolute top-full mt-1.5 left-0 right-0 bg-[#111E33] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            {loading && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-[rgba(238,241,250,0.5)]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Searching connected profiles...
              </div>
            )}

            {!loading && results.length === 0 && (
              <div className="px-4 py-4 text-center">
                <p className="text-xs text-[rgba(238,241,250,0.5)] mb-2">No matching clients found</p>
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
                      "w-full flex items-start gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-b-0"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#0078D7]/15 flex items-center justify-center flex-shrink-0">
                      <Store className="w-4 h-4 text-[#0078D7]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-[#EEF1FA] truncate">
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
                          <MapPin className="w-2.5 h-2.5 text-[rgba(238,241,250,0.4)]" />
                          <span className="text-[10px] text-[rgba(238,241,250,0.5)] truncate">{r.address}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="px-3 py-2 border-t border-white/5 bg-white/2">
              <p className="text-[9px] text-[rgba(238,241,250,0.35)] text-center">
                Searches connected Google Business Profiles
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
