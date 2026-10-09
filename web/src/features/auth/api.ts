import { type Query, type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { User } from "../../api/types";

interface Credentials {
  email: string;
  password: string;
}

interface Registration extends Credentials {
  username: string;
}

interface MeResponse {
  user: User | null;
}

const isNotMe = (query: Query) => query.queryKey[0] !== "me";

// reset, not remove, so mounted observers drop private data and refetch as a guest
export function clearSession(queryClient: QueryClient) {
  queryClient.setQueryData<MeResponse>(["me"], { user: null });
  void queryClient.resetQueries({ predicate: isNotMe });
}

function useSessionMutation<T>(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: T) => api.post<MeResponse>(path, body),
    // a wrong password is a form error, not an expired session
    meta: { expectsUnauthorized: true },
    onSuccess: (data) => {
      queryClient.setQueryData<MeResponse>(["me"], data);
      // pages cached while logged out lack this user's ratings
      void queryClient.invalidateQueries({ predicate: isNotMe });
    },
  });
}

export function useLogin() {
  return useSessionMutation<Credentials>("/auth/login");
}

export function useRegister() {
  return useSessionMutation<Registration>("/auth/register");
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/auth/logout"),
    onSuccess: () => clearSession(queryClient),
  });
}
