import Home from "./pages/Home";
import Services from "./pages/Services";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { Builder } from "./pages/dashboard/Builder";
import { GBPIntegration } from "./pages/dashboard/GBPIntegration";
import { GbpCallback } from "./pages/dashboard/GbpCallback";
import { RestaurantHub } from "./pages/dashboard/RestaurantHub";
import { Analytics } from "./pages/dashboard/Analytics";
import { Leads } from "./pages/dashboard/Leads";
import PortalLogin from "./pages/portal/Login";
import PortalSignup from "./pages/portal/Signup";
import PortalOverview from "./pages/portal/Overview";
import PortalGBP from "./pages/portal/PortalGBP";
import PortalSocial from "./pages/portal/PortalSocial";
import PortalCrm from "./pages/portal/PortalCrm";
import PortalCoach from "./pages/portal/PortalCoach";
import PortalAnalytics from "./pages/portal/PortalAnalytics";
import PortalConnect from "./pages/portal/PortalConnect";
import PortalVault from "./pages/portal/PortalVault";
import PortalHealth from "./pages/portal/PortalHealth";
import PortalListings from "./pages/portal/PortalListings";
import PortalReviews from "./pages/portal/PortalReviews";
import PortalSEO from "./pages/portal/PortalSEO";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { CrmIndex } from "./pages/dashboard/crm/CrmIndex";
import { ClientsList } from "./pages/dashboard/crm/ClientsList";
import { ClientDetail } from "./pages/dashboard/crm/ClientDetail";
import { Catalog } from "./pages/dashboard/crm/Catalog";
import { InvoicesList } from "./pages/dashboard/crm/InvoicesList";
import SocialProfiles from "./pages/dashboard/social/profiles";
import ContentCalendar from "./pages/dashboard/social/calendar";
import SocialInbox from "./pages/dashboard/social/inbox";
import { SmartCampaigns } from "./pages/dashboard/social/campaigns";
import BillingAffiliates from "./pages/dashboard/billing/affiliates";
import { RequirePortalAuth } from "./components/portal/RequirePortalAuth";

/** Wrap an element so unauthenticated users are redirected to /portal/login */
function Auth({ children }: { children: React.ReactNode }) {
  return <RequirePortalAuth>{children}</RequirePortalAuth>;
}

export const routers = [
  {
    path: "/",
    name: "home",
    element: <Home />,
  },
  {
    path: "/services",
    name: "services",
    element: <Services />,
  },
  {
    path: "/pricing",
    name: "pricing",
    element: <Pricing />,
  },
  {
    path: "/about",
    name: "about",
    element: <About />,
  },
  {
    path: "/contact",
    name: "contact",
    element: <Contact />,
  },
  // Agency Command Center — Dashboard Routes (require authentication)
  {
    path: "/dashboard",
    name: "dashboard",
    element: <Auth><Dashboard /></Auth>,
  },
  {
    path: "/builder",
    name: "builder",
    element: <Auth><Builder /></Auth>,
  },
  {
    path: "/gbp",
    name: "gbp",
    element: <Auth><GBPIntegration /></Auth>,
  },
  {
    path: "/gbp/callback",
    name: "gbp-callback",
    element: <Auth><GbpCallback /></Auth>,
  },
  {
    path: "/restaurant",
    name: "restaurant",
    element: <Auth><RestaurantHub /></Auth>,
  },
  {
    path: "/analytics",
    name: "analytics",
    element: <Auth><Analytics /></Auth>,
  },
  {
    path: "/leads",
    name: "leads",
    element: <Auth><Leads /></Auth>,
  },
  // Client Portal — what the agency's clients see
  {
    path: "/portal/login",
    name: "portal-login",
    element: <PortalLogin />,
  },
  {
    path: "/portal/signup",
    name: "portal-signup",
    element: <PortalSignup />,
  },
  {
    path: "/portal/connect",
    name: "portal-connect",
    element: <PortalConnect />,
  },
  {
    path: "/portal",
    name: "portal-root",
    element: <PortalOverview />,
  },
  {
    path: "/portal/:clientId",
    name: "portal-overview",
    element: <PortalOverview />,
  },
  {
    path: "/portal/:clientId/gbp",
    name: "portal-gbp",
    element: <PortalGBP />,
  },
  {
    path: "/portal/:clientId/health",
    name: "portal-health",
    element: <PortalHealth />,
  },
  {
    path: "/portal/:clientId/listings",
    name: "portal-listings",
    element: <PortalListings />,
  },
  {
    path: "/portal/:clientId/reviews",
    name: "portal-reviews",
    element: <PortalReviews />,
  },
  {
    path: "/portal/:clientId/seo",
    name: "portal-seo",
    element: <PortalSEO />,
  },
  {
    path: "/portal/:clientId/social",
    name: "portal-social",
    element: <PortalSocial />,
  },
  {
    path: "/portal/:clientId/coach",
    name: "portal-coach",
    element: <PortalCoach />,
  },
  {
    path: "/portal/:clientId/analytics",
    name: "portal-analytics",
    element: <PortalAnalytics />,
  },
  {
    path: "/portal/:clientId/vault",
    name: "portal-vault",
    element: <PortalVault />,
  },
  {
    path: "/portal/:clientId/crm",
    name: "portal-crm",
    element: <PortalCrm />,
  },
  // Admin (require authentication)
  {
    path: "/admin/users",
    name: "admin-users",
    element: <Auth><AdminUsers /></Auth>,
  },
  // CRM & Billing (require authentication)
  {
    path: "/dashboard/crm",
    name: "crm-index",
    element: <Auth><CrmIndex /></Auth>,
  },
  {
    path: "/dashboard/crm/clients",
    name: "crm-clients",
    element: <Auth><ClientsList /></Auth>,
  },
  {
    path: "/dashboard/crm/clients/:id",
    name: "crm-client-detail",
    element: <Auth><ClientDetail /></Auth>,
  },
  {
    path: "/dashboard/crm/catalog",
    name: "crm-catalog",
    element: <Auth><Catalog /></Auth>,
  },
  {
    path: "/dashboard/crm/invoices",
    name: "crm-invoices",
    element: <Auth><InvoicesList /></Auth>,
  },
  {
    path: "/dashboard/social/profiles",
    name: "social-profiles",
    element: <Auth><SocialProfiles /></Auth>,
  },
  {
    path: "/dashboard/social/calendar",
    name: "social-calendar",
    element: <Auth><ContentCalendar /></Auth>,
  },
  {
    path: "/dashboard/social/inbox",
    name: "social-inbox",
    element: <Auth><SocialInbox /></Auth>,
  },
  {
    path: "/dashboard/social/campaigns",
    name: "social-campaigns",
    element: <Auth><SmartCampaigns /></Auth>,
  },
  {
    path: "/dashboard/billing/affiliates",
    name: "billing-affiliates",
    element: <Auth><BillingAffiliates /></Auth>,
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
