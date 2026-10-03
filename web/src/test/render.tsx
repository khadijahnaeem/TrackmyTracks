import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routes } from "../app/router";

function renderRouter(routeObjects: RouteObject[], path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, queryClient, router };
}

export function renderWithProviders(ui: ReactElement, { path = "/" } = {}) {
  return renderRouter([{ path: "*", element: ui }], path);
}

export function renderAt(path: string) {
  return renderRouter(routes, path);
}
