import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { AGENCIES, DEFAULT_AGENCY_SLUG, getAgency, type Agency } from "@/lib/agencies";

const LS_KEY = "cwd_active_agency";

interface AgencyContextValue {
  agency: Agency;
  setAgencySlug: (slug: string) => void;
  agencies: Agency[];
}

const AgencyContext = createContext<AgencyContextValue>({
  agency: getAgency(DEFAULT_AGENCY_SLUG),
  setAgencySlug: () => {},
  agencies: AGENCIES,
});

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string>(() => {
    try {
      return localStorage.getItem(LS_KEY) ?? DEFAULT_AGENCY_SLUG;
    } catch {
      return DEFAULT_AGENCY_SLUG;
    }
  });

  const setAgencySlug = (next: string) => {
    setSlug(next);
    try {
      localStorage.setItem(LS_KEY, next);
    } catch { /* ignore */ }
  };

  return (
    <AgencyContext.Provider value={{ agency: getAgency(slug), setAgencySlug, agencies: AGENCIES }}>
      {children}
    </AgencyContext.Provider>
  );
}

export function useAgency() {
  return useContext(AgencyContext);
}
