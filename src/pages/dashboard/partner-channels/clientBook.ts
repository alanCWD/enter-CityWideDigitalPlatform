// The client book the engine authorises publishing from.
//
// The dashboard owns provisioning, so it pushes the book with `sync_businesses`.
// The only stable link between the two systems is the dashboard's own client id,
// which the engine names `business_ref` — so the book is our agency's active CRM
// clients, mapped to `{ external_ref, name }`.

import { crm, type CrmClient } from "@/lib/crm";
import type { SyncBusinessInput } from "@/lib/partner-social";

/** One `sync_businesses` call carries at most 500 rows. */
export const BOOK_LIMIT = 500;

const PAGE_SIZE = 250;

export interface ClientBook {
  businesses: SyncBusinessInput[];
  /** active clients the CRM reports, before the engine's cap. */
  total: number;
  /**
   * True when the CRM holds more active clients than one sync may carry.
   * Callers must refuse rather than send: the engine mirrors the whole book it
   * is given, so a partial payload would archive every omitted company.
   */
  overLimit: boolean;
}

export async function readClientBook(agencySlug: string): Promise<ClientBook> {
  const first = await fetchPage(agencySlug, 0);
  const total = first.total;
  const clients = [...first.clients];

  while (clients.length < total && clients.length < BOOK_LIMIT) {
    const next = await fetchPage(agencySlug, clients.length);
    if (next.clients.length === 0) break; // never loop on a page that returns nothing
    clients.push(...next.clients);
  }

  return {
    businesses: clients
      .slice(0, BOOK_LIMIT)
      .map((client) => ({ external_ref: client.id, name: client.name })),
    total,
    overLimit: total > BOOK_LIMIT,
  };
}

async function fetchPage(
  agencySlug: string,
  offset: number,
): Promise<{ clients: CrmClient[]; total: number }> {
  const data = await crm<{ clients: CrmClient[]; total: number }>("clients.list", {
    status: "active",
    agency_id: agencySlug,
    limit: PAGE_SIZE,
    offset,
  });
  return { clients: data.clients ?? [], total: data.total ?? 0 };
}
