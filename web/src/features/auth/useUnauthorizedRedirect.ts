import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { ApiError } from "../../api/client";
import { clearSession } from "./api";
import { loginHref } from "./redirects";

// any write that fails with 401, like an expired session, goes to login and comes back
export function useUnauthorizedRedirect() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "error") return;
        const { error } = event.action;
        if (!(error instanceof ApiError) || error.status !== 401) return;
        if (event.mutation.options.meta?.expectsUnauthorized) return;
        clearSession(queryClient);
        navigate(loginHref(pathname + search));
      }),
    [queryClient, navigate, pathname, search],
  );
}
