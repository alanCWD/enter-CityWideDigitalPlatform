import { useEffect, useState, useCallback } from "react";
import { crm } from "@/lib/crm";
import type { VaultBundle } from "@/lib/vault";

export function useVault(clientId: string | undefined) {
  const [data, setData] = useState<VaultBundle>({ notes: [], credentials: [], files: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!clientId) return;
    setLoading(true); setError(null);
    try {
      const res = await crm<VaultBundle>("vault.list", { client_id: clientId });
      setData({ notes: res.notes ?? [], credentials: res.credentials ?? [], files: res.files ?? [] });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);

  return { ...data, loading, error, reload };
}
