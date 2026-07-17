import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  render as testingLibraryRender,
  type RenderOptions,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createTestQueryClient } from "@/lib/query-client";

type QueryRenderOptions = Omit<RenderOptions, "wrapper"> & {
  queryClient?: QueryClient;
};

export function render(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...options }: QueryRenderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return {
    ...testingLibraryRender(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  };
}

export * from "@testing-library/react";
