// Typed wrapper around the social-syndication backend function (native
// LinkedIn + Meta publishing). Mirrors the `crm()` helper in src/lib/crm.ts.

import { supabase } from "@/integrations/supabase/client";

export interface NativeConnection {
  id: string;
  agency_id: string;
  platform: string;
  handle: string;
  display_name: string;
  profile_url: string;
  is_active: boolean;
  connected_at: string;
  needs_reconnect: boolean;
  last_checked_at: string | null;
  account_type: string;
}

export interface ScheduledNativePost {
  id: string;
  agency_id: string;
  platform: string;
  content: string;
  image_url: string | null;
  scheduled_for: string;
  status: string; // pending | publishing | published | failed | cancelled
  error_message: string | null;
  published_post_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkedinOrg {
  urn: string;
  name: string;
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
}

/** One-shot RPC call to the social-syndication gateway. */
export async function social<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const { data, error } = await supabase.functions.invoke("social-syndication", {
    body: { action, payload },
    headers,
  });

  if (error) throw new Error(`[${action}] ${error.message || "Network error"}`);
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

/** Branded footer appended to every post (APP_NAME → profileUrl). */
export function buildBrandedFooter(profileUrl: string): string {
  return `\n\nCityWide Digital → ${profileUrl}`;
}
