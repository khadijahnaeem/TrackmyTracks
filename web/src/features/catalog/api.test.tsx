import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { useAlbum, useSearch } from "./api";
import { albumDetail, OK_COMPUTER, pageOf, radiohead } from "./test-data";

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("catalog hooks", () => {
  it("stays idle until there is a query", () => {
    const fetchMock = mockFetch({});

    const { result } = renderHook(() => useSearch("song", "", 1), { wrapper: makeWrapper() });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("encodes the query into the search url", async () => {
    mockFetch({ "GET /api/search?type=artist&q=AC%2FDC&page=1": { body: pageOf([radiohead]) } });

    const { result } = renderHook(() => useSearch("artist", "AC/DC", 1), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].name).toBe("Radiohead");
  });

  it("loads album detail", async () => {
    mockFetch({ [`GET /api/albums/${OK_COMPUTER}`]: { body: albumDetail } });

    const { result } = renderHook(() => useAlbum(OK_COMPUTER), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.tracks.map((track) => track.position)).toEqual([1, 2]);
  });
});
