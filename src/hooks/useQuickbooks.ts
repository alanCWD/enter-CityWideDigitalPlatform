import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrand, type ClientBrandAssets } from "@/lib/brand";

export type ReviewPlatformKey = "google" | "facebook" | "bbb" | "yelp";

export interface ReviewPlatform {
  platform: ReviewPlatformKey;
  url: string;
  enabled: boolean;
}

export interface QboConnection {
  id: string;
  crm_client_id: string;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  review_link: string | null;
  review_delay_days: number;
  review_platforms: ReviewPlatform[] | null;
  email_subject: string | null;
  email_intro: string | null;
  from_name: string | null;
  status: string;
  last_error: string | null;
  last_invoice_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewRequest {
  id: string;
  crm_client_id: string;
  qbo_invoice_id: string;
  customer_name: string | null;
  customer_email: string;
  review_link: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
  click_token: string | null;
  clicked_at: string | null;
  clicked_platform: string | null;
}

export interface QboConnectionAttempt {
  id: string;
  crm_client_id: string | null;
  realm_id: string | null;
  stage: string;
  message: string | null;
  user_agent: string | null;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useQboConnection(clientId: string | undefined) {
  const [connection, setConnection] = useState<QboConnection | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await db
      .from("quickbooks_connections")
      .select("*")
      .eq("crm_client_id", clientId)
      .maybeSingle();
    setConnection(data ?? null);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);

  // Pick up a connection the client finished in another tab/window (the
  // QuickBooks flow ends on a separate page), so "Expired" clears by itself.
  useEffect(() => {
    const refresh = () => { if (!document.hidden) reload(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);

  return { connection, loading, reload };
}

export function useReviewRequests(clientId: string | undefined) {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await db
      .from("review_requests")
      .select("*")
      .eq("crm_client_id", clientId)
      .order("sent_at", { ascending: false })
      .limit(50);
    setRequests(data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);
  return { requests, loading, reload };
}

export function useAllReviewRequests() {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("review_requests")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(500);
    setRequests(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { requests, loading, reload };
}

export function useAllQboConnections() {
  const [connections, setConnections] = useState<QboConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("quickbooks_connections")
      .select("*")
      .order("created_at", { ascending: false });
    setConnections(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { connections, loading, reload };
}

export function useQboConnectionAttempts(clientId: string | undefined) {
  const [attempts, setAttempts] = useState<QboConnectionAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await db
      .from("qbo_connection_attempts")
      .select("*")
      .eq("crm_client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20);
    setAttempts(data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);
  return { attempts, loading, reload };
}

export function useClientBrandAssets(clientId: string | undefined) {
  const [assets, setAssets] = useState<ClientBrandAssets | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { assets } = await getBrand(clientId);
      setAssets(assets ?? null);
    } catch {
      setAssets(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);
  return { assets, loading, reload };
}
