import Home from "./pages/Home";
import Services from "./pages/Services";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";

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
