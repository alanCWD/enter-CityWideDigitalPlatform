import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache: Record<string, string> = {};

/** Returns the Zernio profile _id for a given agency slug, creating it if absent. */
export function useZernioProfile(agencySlug: string) {
  const [profileId, setProfileId] = useState<string | null>(cache[agencySlug] ?? null);
  const [loading, setLoading] = useState(!cache[agencySlug]);

  useEffect(() => {
    if (cache[agencySlug]) {
      setProfileId(cache[agencySlug]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase.functions
      .invoke("social-rpc", {
        body: { action: "zernio.profiles", payload: { agency_slug: agencySlug } },
      })
      .then(({ data }) => {
        const id = (data?.profileId ?? data?.profiles?.[0]?._id) as string | undefined;
        if (id) {
          cache[agencySlug] = id;
          setProfileId(id);
        }
      })
      .finally(() => setLoading(false));
  }, [agencySlug]);

  return { profileId, loading };
}
