import { crm } from "@/lib/crm";

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
