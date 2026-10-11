import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { keepPreviousPage } from "../../api/keepPreviousPage";
import type { HistoryEntry, Kind, Page } from "../../api/types";

export function useHistory(username: string, kind: Kind | null, page: number) {
  const params = new URLSearchParams(kind ? { kind, page: String(page) } : { page: String(page) });
  const queryKey = ["history", username, kind, page];
  return useQuery({
    queryKey,
    queryFn: () => api.get<Page<HistoryEntry>>(`/users/${encodeURIComponent(username)}/history?${params}`),
    placeholderData: keepPreviousPage(queryKey),
  });
}
