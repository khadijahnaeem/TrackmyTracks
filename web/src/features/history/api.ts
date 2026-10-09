import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { HistoryEntry, Kind, Page } from "../../api/types";

export function useHistory(username: string, kind: Kind | null, page: number) {
  const params = new URLSearchParams(kind ? { kind, page: String(page) } : { page: String(page) });
  return useQuery({
    queryKey: ["history", username, kind, page],
    queryFn: () => api.get<Page<HistoryEntry>>(`/users/${encodeURIComponent(username)}/history?${params}`),
    // only a page change for the same user and kind keeps the previous page
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === username && previousQuery.queryKey[2] === kind ? previous : undefined,
  });
}
