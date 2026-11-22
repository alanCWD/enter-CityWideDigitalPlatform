/**
 * App catalog for the Citywide dashboard.
 *
 * Citywide is the hub: it owns each client's plan, seats and which apps they
 * have. Inbox Pro is the first app in the catalog.
 *
 * Honesty rules baked into these types:
 * - `status` is only ever what a real Inbox Pro response wrote. Nothing is
 *   inferred, so a client cannot appear "active" from a stored guess.
 * - `seats_used`, `open_conversations` and `last_activity_at` come from a real
 *   status read. They are absent for real rows in this step, and the UI shows
 *   an em dash with the reason instead of a zero.
 * - There is no delete state: a paused app was paused, never deleted.
 */
import { formatDistanceToNow } from "date-fns";

export type AppStatus = "not_connected" | "active" | "paused" | "needs_attention";

export interface AppCatalogEntry {
  app_key: string;
  name: string;
  description: string;
}

export const INBOX_PRO_APP_KEY = "inbox_pro";

export const APP_CATALOG: AppCatalogEntry[] = [
  {
    app_key: INBOX_PRO_APP_KEY,
    name: "Inbox Pro",
    description:
      "Shared team inbox for client conversations, broadcasts and follow-ups.",
  },
];

export interface ClientApp {
  id: string;
  client_id: string;
  app_key: string;
  status: AppStatus;
  /** The id Inbox Pro uses for this client. */
  citywide_client_id: string | null;
  workspace_slug: string | null;
  plan: string | null;
  /** Seat limit for this app. */
  seats: number | null;
  last_sync_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  client_name?: string | null;
  client_status?: string | null;
  client_plan?: string | null;
  client_seats?: number | null;
  client_email?: string | null;
  agency_id?: string;
  /** Populated only by a status read (a later step) — never assumed. */
  seats_used?: number | null;
  open_conversations?: number | null;
  last_activity_at?: string | null;
  /** True only for the clearly labelled sample rows below. Never persisted. */
  is_sample?: boolean;
}

export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  active: "Active",
  paused: "Paused",
  needs_attention: "Needs attention",
  not_connected: "Not connected",
};

/** Needs attention first, then paused, then active, then never-connected. */
const STATUS_PRIORITY: Record<AppStatus, number> = {
  needs_attention: 0,
  paused: 1,
  active: 2,
  not_connected: 3,
};

export function sortClientApps(rows: ClientApp[]): ClientApp[] {
  return [...rows].sort((a, b) => {
    const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (byStatus !== 0) return byStatus;
    return (a.client_name ?? "").localeCompare(b.client_name ?? "");
  });
}

/** "2 hours ago", or null when we have never recorded a timestamp. */
export function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return formatDistanceToNow(d, { addSuffix: true });
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/**
 * Presentation-only sample rows so the Apps surfaces can be judged before any
 * real Inbox Pro record exists. Every row is tagged Sample in the UI, is never
 * written to the database, and disappears as soon as a real record exists.
 */
export const SAMPLE_CLIENT_APPS: ClientApp[] = [
  {
    id: "sample-inbox-pro-1",
    client_id: "sample-client-1",
    app_key: INBOX_PRO_APP_KEY,
    status: "active",
    citywide_client_id: "sample-client-1",
    workspace_slug: "sample-riverside-dental",
    plan: "Growth",
    seats: 5,
    seats_used: 3,
    open_conversations: 6,
    last_sync_at: hoursAgo(2),
    last_checked_at: hoursAgo(2),
    last_activity_at: hoursAgo(1),
    last_error: null,
    client_name: "Sample — Riverside Dental",
    client_status: "active",
    client_plan: "Growth",
    client_seats: 5,
    is_sample: true,
  },
  {
    id: "sample-inbox-pro-2",
    client_id: "sample-client-2",
    app_key: INBOX_PRO_APP_KEY,
    status: "paused",
    citywide_client_id: "sample-client-2",
    workspace_slug: "sample-northline-roofing",
    plan: "Starter",
    seats: 2,
    seats_used: 1,
    open_conversations: 0,
    last_sync_at: hoursAgo(30),
    last_checked_at: hoursAgo(30),
    last_activity_at: hoursAgo(52),
    last_error: null,
    client_name: "Sample — Northline Roofing",
    client_status: "paused",
    client_plan: "Starter",
    client_seats: 2,
    is_sample: true,
  },
  {
    id: "sample-inbox-pro-3",
    client_id: "sample-client-3",
    app_key: INBOX_PRO_APP_KEY,
    status: "needs_attention",
    citywide_client_id: "sample-client-3",
    workspace_slug: "sample-copper-kettle",
    plan: "Pro",
    seats: 8,
    seats_used: 8,
    open_conversations: 14,
    last_sync_at: hoursAgo(74),
    last_checked_at: hoursAgo(74),
    last_activity_at: hoursAgo(74),
    last_error: "Sample: the last status read was rejected by Inbox Pro.",
    client_name: "Sample — Copper Kettle Catering",
    client_status: "active",
    client_plan: "Pro",
    client_seats: 8,
    is_sample: true,
  },
  {
    id: "sample-inbox-pro-4",
    client_id: "sample-client-4",
    app_key: INBOX_PRO_APP_KEY,
    status: "not_connected",
    citywide_client_id: null,
    workspace_slug: null,
    plan: null,
    seats: null,
    seats_used: null,
    open_conversations: null,
    last_sync_at: null,
    last_checked_at: null,
    last_activity_at: null,
    last_error: null,
    client_name: "Sample — Fern & Finch Studio",
    client_status: "lead",
    client_plan: null,
    client_seats: null,
    is_sample: true,
  },
];
