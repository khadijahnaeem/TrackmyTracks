import { QueryClient } from "@tanstack/react-query";

// no automatic retries, error states offer an explicit retry instead
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});
