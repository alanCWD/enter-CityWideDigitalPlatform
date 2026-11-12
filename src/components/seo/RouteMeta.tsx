import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ORIGIN = "https://www.citywidedigital.ca";

type PageMeta = {
  title: string;
  description: string;
};

const DEFAULT_META: PageMeta = {
  title: "CityWide Digital — Managed Digital Presence for Local Businesses",
  description:
    "CityWide Digital connects your Google Business Profile to a live website, all your social channels, and every major directory — automatically.",
};

const PUBLIC_META: Record<string, PageMeta> = {
  "/": {
    title: "CityWide Digital — Your Business Website Runs Itself Online",
    description:
      "CityWide Digital connects your Google Business Profile to a live website, your social channels and 40+ directories — automatically. Plans from $197/mo CAD.",
  },
  "/services": {
    title: "Services — GBP-Synced Websites, Social Sync, Listings & Reviews | CityWide Digital",
    description:
      "Every CityWide service: a website that syncs from your Google Business Profile, one-click social publishing, accurate directory listings and a review engine.",
  },
  "/pricing": {
    title: "Pricing — CityWide Digital",
    description:
      "Starter $197/mo, Growth $397/mo, Pro $597/mo CAD plus GST. 30-day free trial, no card required, no setup fee, cancel anytime.",
  },
  "/about": {
    title: "About CityWide Digital — Managed Local Presence",
    description:
      "Why CityWide Digital builds websites around the Google Business Profile, how setup works, and the questions local business owners ask before starting.",
  },
  "/contact": {
    title: "Contact CityWide Digital",
    description:
      "Talk to CityWide Digital about a Google Business Profile–synced website, or book a 15-minute demo of the sync in action.",
  },
  "/gbp-source-of-truth": {
    title: "Google Business Profile as Your Source of Truth | CityWide Digital",
    description:
      "Why local businesses should manage name, address, phone, hours, services and posts in Google, and let the website and directories follow automatically.",
  },
  "/gbp-local-listing": {
    title: "Google Business Profile as Your Most Important Local Listing | CityWide Digital",
    description:
      "How Google Business Profile drives local search, Maps and the Local Pack, and how CityWide keeps the website and citations aligned with it.",
  },
  "/privacy": {
    title: "Privacy Policy — CityWide Digital",
    description: "How CityWide Digital collects, uses and protects business and customer information.",
  },
  "/terms": {
    title: "Terms of Service — CityWide Digital",
    description: "The terms that apply to CityWide Digital services, billing and website subscriptions.",
  },
};

const PRIVATE_PREFIXES = [
  "/dashboard",
  "/portal",
  "/admin",
  "/builder",
  "/gbp",
  "/qbo",
  "/auth",
  "/channels",
  "/restaurant",
  "/analytics",
  "/leads",
  "/r",
];

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Keeps the document title, description, canonical URL and social tags in step
 * with the public marketing routes. Private application routes are marked
 * noindex and keep the default dashboard metadata.
 */
export function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname.replace(/\/+$/, "") || "/";
    const page = PUBLIC_META[path];
    const isPrivate = PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    const meta = page ?? DEFAULT_META;

    document.title = meta.title;
    upsertMeta("name", "description", meta.description);
    upsertMeta("property", "og:title", meta.title);
    upsertMeta("property", "og:description", meta.description);
    upsertMeta("property", "og:url", `${ORIGIN}${path}`);
    upsertMeta("name", "twitter:title", meta.title);
    upsertMeta("name", "twitter:description", meta.description);

    if (page) {
      upsertCanonical(`${ORIGIN}${path === "/" ? "/" : path}`);
      upsertMeta("name", "robots", "index, follow");
    } else {
      document.head.querySelector('link[rel="canonical"]')?.remove();
      upsertMeta("name", "robots", isPrivate ? "noindex, nofollow" : "index, follow");
    }
  }, [pathname]);

  return null;
}
