import { vi } from "vitest";

interface Reply {
  status?: number;
  body?: unknown;
}

type Replies = Record<string, Reply | ((body: unknown) => Reply | Promise<Reply>)>;

export function mockFetch(replies: Replies) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    const entry = replies[key];
    if (!entry) throw new Error(`Unexpected request ${key}`);
    const requestBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    const { status = 200, body = null } = typeof entry === "function" ? await entry(requestBody) : entry;
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
