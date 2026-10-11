import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent } from "react";
import { useNavigate } from "react-router";
import { hasStatus } from "../../api/client";
import { clearSession } from "./api";
import { useLoginHref } from "./redirects";

// any write that fails with 401, like an expired session, goes to login and comes back
export function useUnauthorizedRedirect() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const login = useLoginHref();

  // reads the current page when the error lands, so navigation never resubscribes
  const redirect = useEffectEvent(() => {
    clearSession(queryClient);
    navigate(login);
  });

  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "error") return;
        if (!hasStatus(event.action.error, 401)) return;
        if (event.mutation.options.meta?.expectsUnauthorized) return;
        redirect();
      }),
    [queryClient],
  );
}
