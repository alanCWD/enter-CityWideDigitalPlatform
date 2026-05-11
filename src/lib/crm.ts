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
  notes: string | null;
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
  stripe_invoice_id: string | null;
  hosted_invoice_url: string | null;
  pdf_url: string | null;
  due_date: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface CrmPayment {
  id: string;
  invoice_id: string | null;
  client_id: string;
  amount_cents: number;
  currency: string;
  method: string | null;
  stripe_payment_id: string | null;
  paid_at: string;
}

export interface CrmMetrics {
  active_clients: number;
  mrr_cents: number;
  outstanding_cents: number;
  overdue_count: number;
}

/** One-shot RPC call. Throws on transport / function error. */
export async function crm<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("bunny-rpc", {
    body: { action, payload },
  });
  if (error) throw new Error(error.message || "Network error");
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
