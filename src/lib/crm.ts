// Typed wrapper around the bunny-rpc edge function.
import { supabase } from "@/integrations/supabase/client";

export interface CrmClient {
  id: string;
  name: string;
  status: "active" | "paused" | "churned" | "lead";
  gbp_connection_id: string | null;
  stripe_customer_id: string | null;
  billing_email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  industry: string | null;
  notes: string | null;
  agency_id: string;
  created_at: string;
  updated_at: string;
}

export interface CrmContact {
  id: string;
  client_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: number;
  created_at: string;
}

export interface CrmProduct {
  id: string;
  name: string;
  description: string | null;
  type: "one_off" | "subscription";
  unit_amount_cents: number;
  currency: string;
  interval: "month" | "year" | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  active: number;
  created_at: string;
}

export interface CrmSubscription {
  id: string;
  client_id: string;
  product_id: string;
  product_name?: string;
  unit_amount_cents?: number;
  currency?: string;
  interval?: string;
  quantity: number;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number;
  stripe_subscription_id: string | null;
  created_at: string;
}

export interface CrmInvoice {
  id: string;
  client_id: string;
  client_name?: string;
  number: string | null;
  status: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  currency: string;
  line_items: string | null;
  stripe_invoice_id: string | null;
  hosted_invoice_url: string | null;
  pdf_url: string | null;
  due_date: string | null;
  issued_at: string | null;
  paid_at: string | null;
  sent_at: string | null;
  payment_method: string | null;
  payment_notes: string | null;
  created_at: string;
}

export interface CrmPayment {
  id: string;
  invoice_id: string | null;
  client_id: string;
  amount_cents: number;
  currency: string;
  method: string | null;
  notes: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string;
}

export interface CrmMetrics {
  active_clients: number;
  mrr_cents: number;
  outstanding_cents: number;
  overdue_count: number;
}

/** A read-only API key shown in the dashboard. The secret is only returned once,
 *  by `apiKeys.create`, and is never re-readable. */
export interface CrmApiKey {
  id: string;
  agency_id: string;
  label: string;
  key_prefix: string;
  scopes: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/** How long a single backend call may take before we give up. Without a bound,
 *  an unresponsive backend leaves the UI on a spinner forever instead of
 *  surfacing an error the user can retry. */
const CRM_TIMEOUT_MS = 30_000;

/** Reject with a readable message if `promise` has not settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} took longer than ${Math.round(ms / 1000)}s to respond.`)),
      ms,
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/** One-shot RPC call. Throws on transport / function error.
 *  Automatically retries once on network-level failures (cold starts, transient drops). */
export async function crm<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  // Await getSession() explicitly so the session is always restored from
  // localStorage before we call invoke — prevents the race condition where
  // the Supabase client falls back to the anon key on first mount.
  const { data: { session } } = await withTimeout(
    supabase.auth.getSession(),
    CRM_TIMEOUT_MS,
    "Session lookup",
  );
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const attempt = () => withTimeout(
    supabase.functions.invoke("bunny-rpc", {
      body: { action, payload },
      headers,
    }),
    CRM_TIMEOUT_MS,
    action,
  );

  let { data, error } = await attempt();

  // Retry once on network-level failures (e.g. edge function cold start).
  if (error && error.message?.includes("Failed to send a request")) {
    await new Promise((r) => setTimeout(r, 1200));
    ({ data, error } = await attempt());
  }

  if (error) throw new Error(`[${action}] ${error.message || "Network error"}`);
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

/** Format cents → "$1,299.00" (locale-aware). */
export function fmtMoney(cents: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format((cents ?? 0) / 100);
}
