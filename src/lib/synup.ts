/**
 * Shared Synup API client for portal pages.
 * Calls the `synup-proxy` edge function with the stored SYNUP_API_KEY.
 * Falls back to mock data when synup_location_id is not configured.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SynupListing {
  site_name: string;
  site_slug?: string;
  status: string;          // "live" | "in_progress" | "failed" | "not_found"
  listing_url?: string;
  category?: string;
}

export interface SynupInteraction {
  id: string;
  rating: number;
  comment: string;
  author_name: string;
  created_at: string;
  source: string;          // "google" | "yelp" | "facebook" …
  response?: { comment: string } | null;
}

export interface SynupInteractionAnalytics {
  average_rating: number;
  total_count: number;
  response_rate?: number;
  rating_distribution?: Record<string, number>; // "1"–"5" → count
}

export interface SynupKeyword {
  keyword: string;
  current_rank: number;
  previous_rank: number;
  search_volume?: number;
}

// Generic proxy call
export async function synupCall<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("synup-proxy", {
    body: { path, params },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

// ── Per-section hooks ─────────────────────────────────────────────────────────

export function useSynupListings(locationId: string | null | undefined) {
  const [listings, setListings] = useState<SynupListing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    synupCall<{ data?: SynupListing[]; results?: SynupListing[] }>(
      `/v2/locations/${locationId}/listings`
    )
      .then((res) => setListings(res?.data ?? res?.results ?? []))
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [locationId]);

  return { listings, loading, error };
}

export function useSynupReviews(locationId: string | null | undefined) {
  const [interactions, setInteractions] = useState<SynupInteraction[] | null>(null);
  const [analytics, setAnalytics] = useState<SynupInteractionAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    setError(null);

    const params = { location_id: locationId, limit: "25" };

    Promise.all([
      synupCall<{ results?: SynupInteraction[]; interactions?: SynupInteraction[] }>(
        "/v2/interactions", params
      ),
      synupCall<SynupInteractionAnalytics>("/v2/interaction_analytics", {
        location_id: locationId,
      }),
    ])
      .then(([iRes, aRes]) => {
        setInteractions(iRes?.results ?? iRes?.interactions ?? []);
        setAnalytics(aRes);
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [locationId]);

  return { interactions, analytics, loading, error };
}

export function useSynupKeywords(locationId: string | null | undefined) {
  const [keywords, setKeywords] = useState<SynupKeyword[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    synupCall<{ results?: SynupKeyword[] }>(
      "/v2/keywords/performance",
      { location_id: locationId }
    )
      .then((res) => setKeywords(res?.results ?? []))
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [locationId]);

  return { keywords, loading, error };
}
