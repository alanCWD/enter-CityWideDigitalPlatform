// Frontend mirror of supabase/functions/_shared/health-catalog.ts.
// Used purely for labels, weights, and category icon lookup. The backend is
// the authoritative source of statuses & evidence.

export type HealthStatus = "pass" | "warn" | "fail" | "unknown" | "skipped";
export type HealthCategory = "foundation" | "gbp" | "performance" | "search" | "citations" | "ops";
export type Evaluator = "derived" | "lighthouse" | "citation" | "manual";

export interface HealthCheckDef {
  key: string;
  category: HealthCategory;
  label: string;
  description?: string;
  weight: number;
  auto: boolean;
  client_visible_default: boolean;
  evaluator: Evaluator;
}

export const HEALTH_CATALOG: HealthCheckDef[] = [
  { key: "has_website", category: "foundation", label: "Has a website", weight: 5, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "has_https", category: "foundation", label: "Website uses HTTPS", weight: 4, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "has_business_email", category: "foundation", label: "Domain-level business email", description: "Not a free provider (gmail/yahoo/outlook/etc.)", weight: 3, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "has_phone", category: "foundation", label: "Phone number on file", weight: 3, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "has_address", category: "foundation", label: "Physical address on file", weight: 3, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "has_category", category: "foundation", label: "Primary GBP category set", weight: 2, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "gbp_connected", category: "gbp", label: "Google Business Profile linked", weight: 5, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "gbp_recently_synced", category: "gbp", label: "GBP synced within 7 days", weight: 2, auto: true, client_visible_default: false, evaluator: "derived" },
  { key: "review_count_floor", category: "gbp", label: "At least 25 Google reviews", weight: 4, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "review_rating_floor", category: "gbp", label: "Average rating at or above 4.0", weight: 4, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "review_response_rate", category: "gbp", label: "Owner responds to reviews", weight: 3, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "posts_recency", category: "gbp", label: "GBP post within 30 days", weight: 2, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "lighthouse_performance", category: "performance", label: "Lighthouse Performance at or above 80", weight: 4, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "lighthouse_seo", category: "performance", label: "Lighthouse SEO at or above 90", weight: 4, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "lighthouse_accessibility", category: "performance", label: "Lighthouse Accessibility at or above 90", weight: 3, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "lighthouse_best_practices", category: "performance", label: "Lighthouse Best Practices at or above 90", weight: 3, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "core_web_vitals", category: "performance", label: "Core Web Vitals pass", description: "LCP / CLS / INP all in 'good' range", weight: 4, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "mobile_friendly", category: "performance", label: "Mobile audit succeeded", weight: 2, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "search_console_connected", category: "search", label: "Search Console connected", weight: 3, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "ga4_connected", category: "search", label: "Google Analytics 4 connected", weight: 3, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "indexed_pages", category: "search", label: "Indexed pages in Google", weight: 2, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "monthly_organic_clicks", category: "search", label: "Monthly organic clicks", weight: 2, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "citation_yelp", category: "citations", label: "Listed on Yelp", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_bing", category: "citations", label: "Listed on Bing Places", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_apple", category: "citations", label: "Listed on Apple Maps", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_facebook", category: "citations", label: "Listed on Facebook", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_yellowpages", category: "citations", label: "Listed on Yellow Pages CA", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_411", category: "citations", label: "Listed on 411.ca", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_cylex", category: "citations", label: "Listed on Cylex", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_foursquare", category: "citations", label: "Listed on Foursquare", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_bbb", category: "citations", label: "Listed on Better Business Bureau", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_mapquest", category: "citations", label: "Listed on MapQuest", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_tripadvisor", category: "citations", label: "Listed on TripAdvisor", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_hotfrog", category: "citations", label: "Listed on Hotfrog", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_brownbook", category: "citations", label: "Listed on Brownbook", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_manta", category: "citations", label: "Listed on Manta", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_findus", category: "citations", label: "Listed on FindUsLocal", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citations_overall", category: "citations", label: "Citation coverage at or above 70%", weight: 4, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "nap_consistency", category: "citations", label: "NAP consistent across listings", description: "Name, Address, Phone match wherever found", weight: 3, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "contract_signed", category: "ops", label: "Service agreement signed", weight: 3, auto: false, client_visible_default: false, evaluator: "manual" },
  { key: "payment_method_on_file", category: "ops", label: "Payment method on file", weight: 3, auto: true, client_visible_default: false, evaluator: "derived" },
  { key: "brand_assets_uploaded", category: "ops", label: "Logo / brand kit in Vault", weight: 2, auto: true, client_visible_default: false, evaluator: "derived" },
  { key: "gbp_credentials_in_vault", category: "ops", label: "GBP login saved to Vault", weight: 2, auto: true, client_visible_default: false, evaluator: "derived" },
  { key: "monthly_report_scheduled", category: "ops", label: "Monthly report cadence agreed", weight: 1, auto: false, client_visible_default: false, evaluator: "manual" },
  { key: "local_seo_active", category: "ops", label: "Active Local SEO subscription", weight: 2, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "social_active", category: "ops", label: "Active Social Marketing subscription", weight: 2, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "reputation_active", category: "ops", label: "Active Reputation Management subscription", weight: 2, auto: true, client_visible_default: true, evaluator: "derived" },
];

export const CATEGORY_META: Record<HealthCategory, { label: string; blurb: string }> = {
  foundation: { label: "Foundation", blurb: "The core building blocks every business needs to be findable." },
  gbp: { label: "Google Business Profile", blurb: "How your business shows up on Google Maps and Search." },
  performance: { label: "Website Performance", blurb: "Speed, accessibility, and SEO health of your website." },
  search: { label: "Search & Analytics", blurb: "Visibility in Google Search and analytics coverage." },
  citations: { label: "Citations & Listings", blurb: "Where your business is listed across the web." },
  ops: { label: "Operations", blurb: "Internal readiness — agreements, assets, and active services." },
};

export function checkLabel(key: string): string {
  return HEALTH_CATALOG.find((c) => c.key === key)?.label ?? key;
}
export function checkDef(key: string): HealthCheckDef | undefined {
  return HEALTH_CATALOG.find((c) => c.key === key);
}
