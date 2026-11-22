import { crm } from "@/lib/crm";

export interface LaunchTicket {
  /** Inbox Pro's one-time sign-in address, including the signed token. */
  url: string;
  /** Unix seconds. The server never issues more than five minutes ahead. */
  expires_at: number;
  role: "admin" | "agent" | "customer";
  workspace_slug: string;
}

/**
 * Ask the server to sign a handoff for this client. The launch secret stays on
 * the server; only the resulting single-use token comes back.
 */
export async function requestInboxLaunch(clientId: string): Promise<LaunchTicket> {
  return crm<LaunchTicket>("clientApps.launch", { client_id: clientId });
}

/**
 * Hand the browser to Inbox Pro in the same tab.
 *
 * The token lives only in this navigation: it is never stored, never put in
 * React state, never logged, and never rendered as a copyable link. The anchor
 * is created, clicked and removed immediately, with `noreferrer` so our URL is
 * not sent along with it.
 */
export function handOffToInboxPro(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noreferrer";
  anchor.referrerPolicy = "no-referrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
