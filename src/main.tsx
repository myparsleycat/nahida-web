import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { Center, ServerCrash } from "./components/common";
import { AliceLoader } from "./components/common/loaders.tsx";
import { NotFound } from "./components/common/NotFound.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";
import { TooltipProvider } from "./components/ui/tooltip.tsx";
import "@/lib/i18n";

import "./styles.css";
import * as TanStackQueryProvider from "./integrations/root-provider.tsx";
import { routeTree } from "./routeTree.gen";

const TanStackQueryProviderContext = TanStackQueryProvider.getContext();

const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProviderContext,
  },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  defaultNotFoundComponent: NotFound,
  defaultPendingMs: 200,
  defaultPendingComponent: () => (
    <Center size="page-full">
      <AliceLoader />
    </Center>
  ),
  defaultErrorComponent: (err) => (
    <Center size="page-full">
      <ServerCrash message={err.error.message} />
    </Center>
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ThemeProvider defaultTheme="dark" storageKey="theme">
        <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </TanStackQueryProvider.Provider>
      </ThemeProvider>
    </StrictMode>,
  );
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { type: "module" }).catch((err) => {
      console.log("ServiceWorker registration failed: ", err);
    });
  });
}
