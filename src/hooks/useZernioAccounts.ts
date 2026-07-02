import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ZernioAccount {
  _id: string;
  platform: string;
  username: string;
  displayName: string;
  profileUrl?: string;
  isActive: boolean;
  profileId: string;
}

export function useZernioAccounts(profileId: string | null) {
  const [accounts, setAccounts] = useState<ZernioAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("social-rpc", {
        body: { action: "zernio.accounts.list", payload: { profile_id: profileId } },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      setAccounts((data?.accounts ?? []) as ZernioAccount[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { reload(); }, [reload]);

  return { accounts, loading, error, reload };
}
