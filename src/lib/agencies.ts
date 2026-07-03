import {
  Building2,
  LayoutTemplate,
  Store,
  BarChart3,
  Bell,
  Utensils,
  Receipt,
  Users,
  Package,
  FileText,
  Share2,
  Leaf,
  Utensils as Fork,
  UserCircle,
  Inbox,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AgencyNavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface Agency {
  slug: string;
  name: string;
  tagline: string;
  /** Tailwind color name (without shade) used for accent dot */
  accent: "blue" | "green" | "orange" | "purple";
  /** Icon representing the agency brand */
  icon: LucideIcon;
  navItems: AgencyNavItem[];
  /** Public-facing website URL */
  url?: string;
  /** Short brand description shown on the dashboard */
  description?: string;
  /** Key feature bullets */
  features?: string[];
  /** Hero stats */
  stats?: { value: string; label: string }[];
}

// ── Shared nav building blocks ───────────────────────────────────────────────
const crmNav: AgencyNavItem[] = [
  { name: "CRM & Billing",     path: "/dashboard/crm",          icon: Receipt,        end: true },
  { name: "Clients",           path: "/dashboard/crm/clients",  icon: Users           },
  { name: "Products & Plans",  path: "/dashboard/crm/catalog",  icon: Package         },
  { name: "Invoices",          path: "/dashboard/crm/invoices", icon: FileText        },
];

// ── Agency definitions ───────────────────────────────────────────────────────
export const AGENCIES: Agency[] = [
  {
    slug: "citywide",
    name: "CityWide Digital",
    tagline: "Full-service digital agency",
    accent: "blue",
    icon: Building2,
    navItems: [
      { name: "Dashboard",        path: "/dashboard",  icon: Building2,    end: true },
      { name: "App Builder",      path: "/builder",    icon: LayoutTemplate           },
      { name: "GBP Integration",  path: "/gbp",        icon: Store                    },
      { name: "Ordering & Menus", path: "/restaurant", icon: Utensils                 },
      { name: "Analytics",        path: "/analytics",  icon: BarChart3                },
      { name: "Leads & Alerts",   path: "/leads",      icon: Bell                     },
      { name: "Social",           path: "/dashboard/social/calendar", icon: Share2   },
      { name: "Inbox",            path: "/dashboard/inbox",            icon: Inbox    },
      ...crmNav,
    ],
  },
  {
    slug: "legacy_leaf",
    name: "Legacy Leaf",
    tagline: "Sovereign cannabis brand management",
    accent: "green",
    icon: Leaf,
    navItems: [
      { name: "Dashboard",       path: "/dashboard",  icon: Building2, end: true },
      { name: "GBP Integration", path: "/gbp",        icon: Store                },
      { name: "Analytics",       path: "/analytics",  icon: BarChart3            },
      { name: "Leads & Alerts",  path: "/leads",      icon: Bell                 },
      { name: "Social",          path: "/dashboard/social/calendar", icon: Share2 },
      { name: "Inbox",           path: "/dashboard/inbox",            icon: Inbox  },
      ...crmNav,
    ],
  },
  {
    slug: "foodiio",
    name: "Foodiio",
    tagline: "Restaurants & hospitality tech",
    accent: "orange",
    icon: Fork,
    navItems: [
      { name: "Dashboard",        path: "/dashboard",  icon: Building2, end: true },
      { name: "GBP Integration",  path: "/gbp",        icon: Store                },
      { name: "Ordering & Menus", path: "/restaurant", icon: Utensils             },
      { name: "Analytics",        path: "/analytics",  icon: BarChart3            },
      { name: "Leads & Alerts",   path: "/leads",      icon: Bell                 },
      { name: "Social",           path: "/dashboard/social/calendar", icon: Share2 },
      { name: "Inbox",            path: "/dashboard/inbox",            icon: Inbox  },
      ...crmNav,
    ],
  },
  {
    slug: "oneprofile",
    name: "OneProfile",
    tagline: "Creator & professional portfolios",
    accent: "purple",
    icon: UserCircle,
    url: "https://oneprofile.citywidedigital.ca",
    description: "The narrative-driven identity hub for authors, chefs, brewers, vintners, sommeliers, and every creative who deserves more than a generic portfolio site. Post once, distribute everywhere.",
    features: [
      "Narrative Hub — origin story, philosophy, key influences, and creative context",
      "Portfolio Engine — profession-specific metadata for books, dishes, releases, and tastings",
      "Social Syndication — LinkedIn, Instagram, and Facebook in platform-native formats",
    ],
    stats: [
      { value: "2,400+", label: "Creative Profiles" },
      { value: "6",      label: "Profession Categories" },
      { value: "12+",    label: "Social Platforms" },
    ],
    navItems: [
      { name: "Dashboard",       path: "/dashboard",  icon: Building2, end: true },
      { name: "Analytics",       path: "/analytics",  icon: BarChart3            },
      { name: "Social",          path: "/dashboard/social/calendar", icon: Share2 },
      { name: "Inbox",           path: "/dashboard/inbox",            icon: Inbox  },
      ...crmNav,
    ],
  },
];

export const DEFAULT_AGENCY_SLUG = "citywide";

export function getAgency(slug: string): Agency {
  return AGENCIES.find((a) => a.slug === slug) ?? AGENCIES[0];
}

export const ACCENT_CLASSES: Record<Agency["accent"], { dot: string; text: string; bg: string; border: string }> = {
  blue:   { dot: "bg-blue-500",   text: "text-blue-500",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
  green:  { dot: "bg-emerald-500",text: "text-emerald-500",bg: "bg-emerald-500/10",border: "border-emerald-500/20" },
  orange: { dot: "bg-orange-500", text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  purple: { dot: "bg-purple-500", text: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
};
