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
import { Coaching } from "./pages/dashboard/Coaching";
import PortalLogin from "./pages/portal/Login";
import PortalSignup from "./pages/portal/Signup";
import PortalOverview from "./pages/portal/Overview";
import PortalGBP from "./pages/portal/PortalGBP";
import PortalSocial from "./pages/portal/PortalSocial";
import PortalCoach from "./pages/portal/PortalCoach";
import PortalAnalytics from "./pages/portal/PortalAnalytics";
import PortalConnect from "./pages/portal/PortalConnect";
import { AdminUsers } from "./pages/admin/AdminUsers";

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
  // Agency Command Center — Dashboard Routes
  {
    path: "/dashboard",
    name: "dashboard",
    element: <Dashboard />,
  },
  {
    path: "/builder",
    name: "builder",
    element: <Builder />,
  },
  {
    path: "/gbp",
    name: "gbp",
    element: <GBPIntegration />,
  },
  {
    path: "/gbp/callback",
    name: "gbp-callback",
    element: <GbpCallback />,
  },
  {
    path: "/restaurant",
    name: "restaurant",
    element: <RestaurantHub />,
  },
  {
    path: "/analytics",
    name: "analytics",
    element: <Analytics />,
  },
  {
    path: "/leads",
    name: "leads",
    element: <Leads />,
  },
  {
    path: "/coaching",
    name: "coaching",
    element: <Coaching />,
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
  // Admin
  {
    path: "/admin/users",
    name: "admin-users",
    element: <AdminUsers />,
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
