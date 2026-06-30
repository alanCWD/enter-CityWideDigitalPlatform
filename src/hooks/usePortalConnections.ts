import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PortalConnection {
  id: string;
  client_label: string;
  business_name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  review_count: number | null;
  last_synced_at: string | null;
  zernio_profile_id: string | null;
  synup_location_id: string | null;
}

/**
 * Loads ALL gbp_connections the signed-in user is linked to via portal_users.
 */
export function usePortalConnections(userId: string | undefined) {
  const [connections, setConnections] = useState<PortalConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setConnections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Get linked connection ids
    const { data: links, error: linkErr } = await supabase
      .from("portal_users")
      .select("connection_id")
      .eq("user_id", userId);
    if (linkErr || !links || links.length === 0) {
      setConnections([]);
      setLoading(false);
      return;
    }
    const ids = links.map((l) => l.connection_id);
    const { data: conns } = await supabase
      .from("gbp_connections")
      .select("id,client_label,business_name,address,phone,website,category,rating,review_count,last_synced_at,zernio_profile_id,synup_location_id")
      .in("id", ids);
    setConnections((conns ?? []) as PortalConnection[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { connections, loading, reload };
}
