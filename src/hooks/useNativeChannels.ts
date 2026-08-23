import { useCallback, useEffect, useState } from "react";
import { social, type NativeConnection } from "@/lib/social";

export type ChannelStatus =
  | "loading"
  | "connected"
  | "disconnected"
  | "needs-reconnect";

interface ConnectionState {
  connections: NativeConnection[];
  loading: boolean;
  reload: () => Promise<void>;
}

/** Load the agency's native channel_connections rows (cheap, no API call). */
function useConnections(): ConnectionState {
  const [connections, setConnections] = useState<NativeConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await social<{ ok: boolean; connections: NativeConnection[] }>("connection.list");
      setConnections(res.connections ?? []);
    } catch (e) {
      console.error("connection.list failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { connections, loading, reload };
}

export function useLinkedInStatus() {
  const { connections, loading, reload } = useConnections();
  const conn = connections.find((c) => c.platform === "linkedin");

  const status: ChannelStatus = loading
    ? "loading"
    : !conn
      ? "disconnected"
      : conn.needs_reconnect
        ? "needs-reconnect"
        : conn.is_active
          ? "connected"
          : "disconnected";

  const checkNow = useCallback(async () => {
    await social("connection.check", { platform: "linkedin" });
    await reload();
  }, [reload]);

  return {
    status,
    displayName: conn?.display_name ?? null,
    handle: conn?.handle ?? null,
    accountType: conn?.account_type ?? "personal",
    loading,
    reload,
    checkNow,
  };
}

export function useMetaStatus() {
  const { connections, loading, reload } = useConnections();
  const fb = connections.find((c) => c.platform === "facebook");
  const ig = connections.find((c) => c.platform === "instagram");

  const facebookStatus: ChannelStatus = loading
    ? "loading"
    : !fb
      ? "disconnected"
      : fb.needs_reconnect
        ? "needs-reconnect"
        : fb.is_active
          ? "connected"
          : "disconnected";

  const instagramStatus: ChannelStatus = loading
    ? "loading"
    : !ig
      ? "disconnected"
      : ig.needs_reconnect
        ? "needs-reconnect"
        : ig.is_active
          ? "connected"
          : "disconnected";

  const checkNow = useCallback(async () => {
    await social("connection.check", { platform: "meta" });
    await reload();
  }, [reload]);

  return {
    facebookStatus,
    instagramStatus,
    facebookDisplayName: fb?.display_name ?? null,
    instagramDisplayName: ig?.display_name ?? null,
    loading,
    reload,
    checkNow,
  };
}
