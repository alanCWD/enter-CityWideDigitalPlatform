import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Outlet, RouterProvider} from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AgencyProvider } from "@/contexts/AgencyContext";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { RouteMeta } from "@/components/seo/RouteMeta";
import { routers } from "./router";

const queryClient = new QueryClient();

const RouteShell = () => (
  <>
    <ScrollToTop />
    <RouteMeta />
    <Outlet />
  </>
);

const router = createBrowserRouter([{ element: <RouteShell />, children: routers }]);

const App = () => {
  return (
    <ThemeProvider>
      <AgencyProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <RouterProvider router={router} />
          </TooltipProvider>
        </QueryClientProvider>
      </AgencyProvider>
    </ThemeProvider>
  )
};

export default App;
