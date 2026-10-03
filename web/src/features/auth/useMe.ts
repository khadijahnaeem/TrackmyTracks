import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { User } from "../../api/types";

export function useMe() {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ user: User | null }>("/auth/me"),
  });
  return { user: data?.user ?? null, isLoading };
}
