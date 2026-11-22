import { useCallback, useEffect, useState } from "react";
import { crm } from "@/lib/crm";
import { INBOX_PRO_APP_KEY, type ClientApp } from "@/lib/apps";

/**
 * Reads this agency's client app records. Pass `clientId` for one client.
 *
 * A failed read surfaces the reason and never falls back to a reassuring
 * default: an error here means we do not know the app state.
 */
export function useClientApps(opts: { clientId?: string; appKey?: string } = {}) {
  const { clientId, appKey = INBOX_PRO_APP_KEY } = opts;
  const [rows, setRows] = useState<ClientApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { app_key: appKey };
      if (clientId) payload.client_id = clientId;
      const data = await crm<{ client_apps: ClientApp[] }>("clientApps.list", payload);
      setRows(data.client_apps ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [clientId, appKey]);

  useEffect(() => { void reload(); }, [reload]);

  return { rows, loading, error, reload };
}
