// a paged query keeps showing its previous page while the next loads, but only when every key part before the page matches
export function keepPreviousPage(queryKey: readonly unknown[]) {
  return <T>(previous: T | undefined, previousQuery?: { queryKey: readonly unknown[] }) =>
    previousQuery && queryKey.slice(0, -1).every((part, i) => part === previousQuery.queryKey[i])
      ? previous
      : undefined;
}
