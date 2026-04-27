import Home from "./pages/Home";
import Services from "./pages/Services";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { Builder } from "./pages/dashboard/Builder";
import { GBPIntegration } from "./pages/dashboard/GBPIntegration";
import { RestaurantHub } from "./pages/dashboard/RestaurantHub";
import { Analytics } from "./pages/dashboard/Analytics";
import { Leads } from "./pages/dashboard/Leads";
import { Coaching } from "./pages/dashboard/Coaching";

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
