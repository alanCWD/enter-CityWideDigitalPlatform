import { crm } from "@/lib/crm";
import type { AppStatus } from "@/lib/apps";

/**
 * What a live status read may return. Inbox Pro's raw response never reaches
 * the browser — the server maps it onto exactly these fields.
 */
export interface ClientAppStatus {
  linked: boolean;
  status: AppStatus;
  plan: string | null;
  seats: number | null;
  seats_used: number | null;
  open_conversations: number | null;
  last_activity_at: string | null;
  /** When the last read was attempted. */
  last_checked_at: string | null;
  /** When a read last succeeded. Numbers after this are last-known. */
  status_ok_at: string | null;
  error: string | null;
}

export function readClientAppStatus(
  clientId: string,
  refresh = false,
): Promise<ClientAppStatus> {
  return crm<ClientAppStatus>("clientApps.status", { client_id: clientId, refresh });
}

/**
 * The dashboard-side actions that change a client's Inbox Pro tenant. Every one
 * of them runs on the server, which owns the sync secret; the browser only
 * learns the outcome.
 */
export interface ClientAppSyncResult {
  ok: boolean;
  status: "active" | "paused";
  workspace_slug: string | null;
  plan: string | null;
  seats: number | null;
}

export function connectClientApp(clientId: string): Promise<ClientAppSyncResult> {
  return crm<ClientAppSyncResult>("clientApps.connect", { client_id: clientId });
}

export function syncClientApp(clientId: string): Promise<ClientAppSyncResult> {
  return crm<ClientAppSyncResult>("clientApps.sync", { client_id: clientId });
}

export function pauseClientApp(clientId: string): Promise<ClientAppSyncResult> {
  return crm<ClientAppSyncResult>("clientApps.pause", { client_id: clientId });
}

export function resumeClientApp(clientId: string): Promise<ClientAppSyncResult> {
  return crm<ClientAppSyncResult>("clientApps.resume", { client_id: clientId });
}

export function setClientAppPlan(
  clientId: string,
  plan: string,
  seats: number,
): Promise<ClientAppSyncResult> {
  return crm<ClientAppSyncResult>("clientApps.plan", { client_id: clientId, plan, seats });
}
