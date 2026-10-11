import { useLocation } from "react-router";

// a single leading slash keeps the redirect on this site, // and /\ are read as other hosts
export function safeNext(next: string | null): string | null {
  return next && /^\/(?![/\\])/.test(next) ? next : null;
}

export function authHref(path: "/login" | "/register", next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export function loginHref(next: string): string {
  return authHref("/login", next);
}

// log in and come back to the page being viewed
export function useLoginHref(): string {
  const { pathname, search } = useLocation();
  return loginHref(pathname + search);
}
