import { useEffect, useRef } from "react";

export function pageParam(params: URLSearchParams): number {
  const page = Number(params.get("page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

interface PagedQuery {
  data: unknown;
  isError: boolean;
  isPlaceholderData: boolean;
}

// focuses the results heading once a page change from the pagination control settles
export function useResultsFocus(query: PagedQuery) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    if (pending.current && !query.isPlaceholderData) {
      pending.current = false;
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [query.isPlaceholderData, query.data, query.isError]);

  return {
    headingRef,
    focusOnSettle: () => {
      pending.current = true;
    },
  };
}
