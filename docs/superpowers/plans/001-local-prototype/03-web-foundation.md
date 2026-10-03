# Slice 03 Web Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A React app with the design system, API client, router, and test helpers, so feature slices only add pages and components.

**Architecture:** Vite serves the SPA and proxies `/api` to Flask. Design tokens in one CSS file drive a small set of `ui/` components styled with CSS Modules. TanStack Query owns server state, and each feature contributes a route array that the router composes.

**Tech Stack:** Vite, React 19, TypeScript, React Router 7, TanStack Query 5, CSS Modules, Fontsource, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/001-local-prototype-design.md`

**Index:** `docs/superpowers/plans/001-local-prototype.md`. Its Global Constraints and Contracts apply to every task here.

**Branch:** `slice/03-web-foundation`. No dependencies, start any time.

---

## File map

```
web/
  index.html, public/favicon.svg, vite.config.ts, package.json
  src/main.tsx
  src/app/App.tsx, router.ts, AppShell.tsx, AppShell.module.css, NotFoundPage.tsx
  src/api/client.ts, types.ts, queryClient.ts
  src/features/auth/routes.ts, useMe.ts
  src/features/catalog/routes.ts
  src/features/history/routes.ts
  src/features/playlists/routes.ts
  src/ui/tokens.css, global.css, cx.ts, format.ts, index.ts
  src/ui/Button.tsx, Spinner.tsx, Card.tsx, TextField.tsx, TextArea.tsx, Skeleton.tsx,
  src/ui/Notice.tsx, PageHeader.tsx, Pagination.tsx, SegmentedControl.tsx, Stars.tsx,
  plus one .module.css per component
  src/test/setup.ts, render.tsx, fetch.ts
.github/workflows/web.yml
README.md                    web setup section
```

## Design language

| Token group | Values |
|---|---|
| Color | bg `#111315`, surface `#191c1f`, raised `#22262a`, border `#2e3338`, text `#eceef0`, muted `#9ba3ab`, accent `#e8a33d`, danger `#ef7b6f` |
| Type | Fraunces for headings, Public Sans for everything else. Ramp xs 12/16, sm 14/20, base 16/24, lg 20/28, xl 24/32, 2xl 32/40, 3xl 40/48 |
| Space | 4, 8, 12, 16, 24, 32, 48, 64 px as `--space-1` to `--space-16` |
| Shape | one `--radius` of 8px, `--radius-full` only for spinners |
| Motion | `--duration` 150ms on color and border changes only, nothing moves on hover |

Dark, warm, and quiet, like a record shop at night. The amber accent marks two things only: stars and primary actions.

---

### Task 1: Scaffold the Vite app

**Files:**
- Create: `web/` via the Vite template
- Modify: `web/package.json`, `web/vite.config.ts`, `web/index.html`
- Create: `web/public/favicon.svg`, `web/src/test/setup.ts`
- Delete: `web/src/App.tsx`, `web/src/App.css`, `web/src/index.css`, `web/src/assets/`, `web/public/vite.svg`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run dev` on 5173 proxying `/api` to `127.0.0.1:5001`, plus `npm test`, `npm run lint`, `npm run build`

- [ ] **Step 1: Generate and install**

```bash
git checkout -b slice/03-web-foundation
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install react-router@7 @tanstack/react-query@5 @fontsource-variable/fraunces @fontsource-variable/public-sans
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Remove the demo content**

```bash
rm -r src/App.tsx src/App.css src/index.css src/assets public/vite.svg
```

- [ ] **Step 3: Configure Vite and Vitest**

`web/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // 127.0.0.1 because Node resolves localhost to IPv6 first and Flask listens on IPv4
  server: { proxy: { "/api": "http://127.0.0.1:5001" } },
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts" },
});
```

If the template generated `@vitejs/plugin-react-swc` instead, keep that import name.

Add to `scripts` in `web/package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

`web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
```

- [ ] **Step 4: Page metadata and favicon**

`web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Rate and review songs, albums, and artists, and see what other listeners think of them."
    />
    <meta name="theme-color" content="#111315" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>TrackmyTracks</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`web/public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="15" fill="#111315"/>
  <circle cx="16" cy="16" r="10.5" fill="none" stroke="#2e3338" stroke-width="2"/>
  <circle cx="16" cy="16" r="4.5" fill="#e8a33d"/>
</svg>
```

- [ ] **Step 5: Commit**

`src/main.tsx` still imports the deleted files, so the build passes again after Task 6. Commit the scaffold now so the template output reviews separately from our code.

```bash
git add web/
git commit -m "chore(web): scaffold vite react app with vitest"
```

### Task 2: Tokens, global styles, and format helpers

**Files:**
- Create: `web/src/ui/tokens.css`, `web/src/ui/global.css`, `web/src/ui/cx.ts`, `web/src/ui/format.ts`
- Test: `web/src/ui/format.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: every CSS custom property in the Design language table, `cx(...names)`, `formatAverage(stars: number): string`, `formatDuration(ms: number): string`, `formatDate(iso: string): string`, `pluralize(count: number, noun: string): string`

- [ ] **Step 1: Write the failing tests**

`web/src/ui/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatAverage, formatDate, formatDuration, pluralize } from "./format";

describe("format", () => {
  it("shows averages with one decimal", () => {
    expect(formatAverage(3.7)).toBe("3.7");
    expect(formatAverage(4)).toBe("4.0");
  });

  it("formats track length as minutes and seconds", () => {
    expect(formatDuration(284400)).toBe("4:44");
    expect(formatDuration(61000)).toBe("1:01");
  });

  it("formats dates for people", () => {
    expect(formatDate("2026-10-02T18:30:00+00:00")).toBe("Oct 2, 2026");
  });

  it("pluralizes nouns", () => {
    expect(pluralize(1, "song")).toBe("1 song");
    expect(pluralize(3, "song")).toBe("3 songs");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/format.test.ts`
Expected: FAIL, cannot resolve `./format`

- [ ] **Step 3: Write the implementation**

`web/src/ui/format.ts`:

```ts
export function formatAverage(stars: number): string {
  return stars.toFixed(1);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${Math.floor(totalSeconds / 60)}:${seconds}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
```

`web/src/ui/cx.ts`:

```ts
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}
```

`web/src/ui/tokens.css`:

```css
:root {
  color-scheme: dark;

  --color-bg: #111315;
  --color-surface: #191c1f;
  --color-surface-raised: #22262a;
  --color-border: #2e3338;
  --color-text: #eceef0;
  --color-text-muted: #9ba3ab;
  --color-accent: #e8a33d;
  --color-accent-hover: #f0b65c;
  --color-on-accent: #1b1305;
  --color-danger: #ef7b6f;

  --font-heading: "Fraunces Variable", Georgia, serif;
  --font-body: "Public Sans Variable", system-ui, sans-serif;

  --text-xs: 0.75rem;
  --leading-xs: 1rem;
  --text-sm: 0.875rem;
  --leading-sm: 1.25rem;
  --text-base: 1rem;
  --leading-base: 1.5rem;
  --text-lg: 1.25rem;
  --leading-lg: 1.75rem;
  --text-xl: 1.5rem;
  --leading-xl: 2rem;
  --text-2xl: 2rem;
  --leading-2xl: 2.5rem;
  --text-3xl: 2.5rem;
  --leading-3xl: 3rem;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  --radius: 8px;
  --radius-full: 999px;
  --shadow-overlay: 0 8px 24px rgb(0 0 0 / 0.45);
  --control-height: 2.5rem;
  --content-width: 72rem;
  --duration: 150ms;
}
```

`web/src/ui/global.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-base);
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3 {
  font-family: var(--font-heading);
  font-weight: 600;
}

h1 {
  font-size: var(--text-3xl);
  line-height: var(--leading-3xl);
}

h2 {
  font-size: var(--text-xl);
  line-height: var(--leading-xl);
}

h3 {
  font-size: var(--text-lg);
  line-height: var(--leading-lg);
}

a {
  color: inherit;
  text-decoration: none;
  transition: color var(--duration);
}

a:hover {
  color: var(--color-accent);
}

button,
input,
textarea {
  font: inherit;
  color: inherit;
}

:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

img,
svg {
  display: block;
  max-width: 100%;
}

@media (max-width: 640px) {
  h1 {
    font-size: var(--text-2xl);
    line-height: var(--leading-2xl);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0ms !important;
    transition-duration: 0ms !important;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/format.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add web/src/ui
git commit -m "feat(web): add design tokens, global styles, and format helpers"
```

### Task 3: API client, types, and test helpers

**Files:**
- Create: `web/src/api/client.ts`, `web/src/api/types.ts`, `web/src/api/queryClient.ts`
- Create: `web/src/features/auth/useMe.ts`
- Create: `web/src/test/fetch.ts`
- Test: `web/src/api/client.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `api.get<T>(path)`, `api.post<T>(path, body?)`, `api.put<T>(path, body)`, `api.patch<T>(path, body)`, `api.delete<T>(path)`, with paths relative to `/api`
  - `ApiError` with `status`, `code`, `message`, and `errorMessage(error: unknown): string`
  - every JSON shape from the index as an exported type
  - `queryClient`
  - `useMe(): { user: User | null; isLoading: boolean }`
  - `mockFetch(replies)`, which stubs `fetch` for tests. Keys look like `"GET /api/auth/me"`, values are `{status?, body?}` or a function of the parsed request body returning one

- [ ] **Step 1: Write the failing tests**

`web/src/test/fetch.ts`:

```ts
import { vi } from "vitest";

interface Reply {
  status?: number;
  body?: unknown;
}

type Replies = Record<string, Reply | ((body: unknown) => Reply)>;

export function mockFetch(replies: Replies) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    const entry = replies[key];
    if (!entry) throw new Error(`Unexpected request ${key}`);
    const requestBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    const { status = 200, body = null } = typeof entry === "function" ? entry(requestBody) : entry;
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
```

`web/src/api/client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { mockFetch } from "../test/fetch";
import { api, ApiError, errorMessage } from "./client";

describe("api client", () => {
  it("returns parsed json", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });

    await expect(api.get("/auth/me")).resolves.toEqual({ user: null });
  });

  it("sends json bodies", async () => {
    const fetchMock = mockFetch({ "PUT /api/ratings": (body) => ({ body }) });

    await expect(api.put("/ratings", { stars: 4 })).resolves.toEqual({ stars: 4 });
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("resolves empty responses", async () => {
    mockFetch({ "POST /api/auth/logout": { status: 204 } });

    await expect(api.post("/auth/logout")).resolves.toBeUndefined();
  });

  it("throws api errors with code and message", async () => {
    mockFetch({
      "GET /api/songs/x": { status: 404, body: { error: { code: "not_found", message: "Song not found" } } },
    });

    const error = await api.get("/songs/x").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "not_found", message: "Song not found" });
  });

  it("explains an unreachable server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await api.get("/auth/me").catch((caught) => caught);

    expect(errorMessage(error)).toBe("Could not reach the server, check that the API is running");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/api/client.test.ts`
Expected: FAIL, cannot resolve `./client`

- [ ] **Step 3: Write the implementation**

`web/src/api/client.ts`:

```ts
const UNREACHABLE = "Could not reach the server, check that the API is running";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNREACHABLE;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;

  // the vite proxy answers with html when flask is down
  const data = await response.json().catch(() => null);
  if (response.ok) return data as T;
  if (data?.error) throw new ApiError(response.status, data.error.code, data.error.message);
  throw new ApiError(response.status, "server_unreachable", UNREACHABLE);
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
```

`web/src/api/types.ts`:

```ts
export type Kind = "song" | "album" | "artist";

export interface ArtistSummary {
  mbid: string;
  name: string;
}

export interface AlbumSummary {
  mbid: string;
  title: string;
  release_year: number | null;
  artist: ArtistSummary;
}

export interface SongSummary {
  mbid: string;
  title: string;
  disambiguation: string | null;
  length_ms: number | null;
  artist: ArtistSummary;
}

export interface MyRating {
  stars: number;
  is_derived: boolean;
  song_count: number;
  review: string | null;
}

export interface CommunityRating {
  stars: number | null;
  count: number;
}

export interface RatingSummary {
  mine: MyRating | null;
  community: CommunityRating;
}

export type Rated<T> = T & { rating: RatingSummary };

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface PublicUser {
  username: string;
}

export interface Review {
  id: number;
  user: PublicUser;
  stars: number;
  review: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: number;
  kind: Kind;
  item: ArtistSummary | AlbumSummary | SongSummary;
  stars: number;
  review: string | null;
  updated_at: string;
}

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  owner: PublicUser;
  song_count: number;
  updated_at: string;
}

export interface PlaylistDetail extends Playlist {
  songs: SongSummary[];
}
```

`web/src/api/queryClient.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";

// no automatic retries, error states offer an explicit retry instead
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});
```

`web/src/features/auth/useMe.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/api/client.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add web/src/api web/src/features/auth web/src/test
git commit -m "feat(web): add api client, response types, and fetch test helper"
```

### Task 4: Core UI components

**Files:**
- Create: `web/src/ui/Spinner.tsx`, `Spinner.module.css`
- Create: `web/src/ui/Button.tsx`, `Button.module.css`
- Create: `web/src/ui/Card.tsx`, `Card.module.css`
- Create: `web/src/ui/TextField.tsx`, `web/src/ui/TextArea.tsx`, `Field.module.css`
- Create: `web/src/ui/Skeleton.tsx`, `Skeleton.module.css`
- Create: `web/src/ui/Notice.tsx`, `Notice.module.css`
- Create: `web/src/ui/PageHeader.tsx`, `PageHeader.module.css`
- Create: `web/src/ui/Pagination.tsx`, `Pagination.module.css`
- Create: `web/src/ui/SegmentedControl.tsx`, `SegmentedControl.module.css`
- Test: `web/src/ui/components.test.tsx`

**Interfaces:**
- Consumes: tokens, `cx`, `ApiError` and `errorMessage` from Task 3
- Produces:
  - `Button({variant?: "primary" | "secondary" | "ghost", loading?, ...buttonProps})`, `buttonClassName(variant?)` for links styled as buttons
  - `Spinner({label?, className?})`
  - `Card({children, className?})`
  - `TextField({label, error?, ...inputProps})`
  - `TextArea({label, value, maxLength, error?, ...textareaProps})` with a live character counter
  - `Skeleton({width?, height?})`
  - `Notice({title, children?, action?})` for empty states, `ErrorNotice({error, onRetry?})` for failures
  - `PageHeader({title, eyebrow?, meta?, actions?})`, which also sets the document title
  - `Pagination({page, pages, onPageChange})`, previous and next controls that render nothing for a single page
  - `SegmentedControl<T extends string>({label, options: {value, label}[], value, onChange})`, a group of pressed buttons for filters like search type and history kind
  - `Button` accepts `ref`

- [ ] **Step 1: Write the failing tests**

`web/src/ui/components.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { Button } from "./Button";
import { ErrorNotice } from "./Notice";
import { PageHeader } from "./PageHeader";
import { Pagination } from "./Pagination";
import { SegmentedControl } from "./SegmentedControl";
import { TextArea } from "./TextArea";
import { TextField } from "./TextField";

describe("ui components", () => {
  it("disables a loading button and announces progress", () => {
    render(<Button loading>Save</Button>);

    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("links a text field label and error", () => {
    render(<TextField label="Email" error="Email is required" />);

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Email is required");
    expect(screen.getByLabelText("Email")).toBeInvalid();
  });

  it("counts characters in a text area", () => {
    render(<TextArea label="Review" value="Great record" maxLength={2000} onChange={() => {}} />);

    expect(screen.getByText("12 / 2000")).toBeInTheDocument();
  });

  it("shows the api error message", () => {
    const error = new ApiError(502, "catalog_unavailable", "Music catalog is unavailable, try again");
    render(<ErrorNotice error={error} onRetry={() => {}} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Music catalog is unavailable, try again");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("titles the page", () => {
    render(<PageHeader title="OK Computer" eyebrow="Album" />);

    expect(screen.getByRole("heading", { level: 1, name: "OK Computer" })).toBeInTheDocument();
    expect(document.title).toBe("OK Computer | TrackmyTracks");
  });

  it("pages forward and disables the edges", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pages={3} onPageChange={onPageChange} />);

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("hides pagination for a single page", () => {
    const { container } = render(<Pagination page={1} pages={1} onPageChange={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("marks the selected option and reports changes", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Result type"
        options={[
          { value: "song", label: "Songs" },
          { value: "album", label: "Albums" },
        ]}
        value="song"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("group", { name: "Result type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Songs" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Albums" }));

    expect(onChange).toHaveBeenCalledWith("album");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/components.test.tsx`
Expected: FAIL, cannot resolve `./Button`

- [ ] **Step 3: Write Spinner and Button**

`web/src/ui/Spinner.tsx`:

```tsx
import { cx } from "./cx";
import styles from "./Spinner.module.css";

interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label = "Loading", className }: SpinnerProps) {
  return <span role="status" aria-label={label} className={cx(styles.spinner, className)} />;
}
```

`web/src/ui/Spinner.module.css`:

```css
.spinner {
  display: inline-block;
  width: var(--space-4);
  height: var(--space-4);
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: var(--radius-full);
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

`web/src/ui/Button.tsx`:

```tsx
import type { ComponentProps } from "react";
import styles from "./Button.module.css";
import { cx } from "./cx";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost";

// ComponentProps includes ref, which React 19 passes as a regular prop
interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  loading?: boolean;
}

export function buttonClassName(variant: Variant = "secondary"): string {
  return cx(styles.button, styles[variant]);
}

export function Button({
  variant = "secondary",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClassName(variant), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={styles.label}>{children}</span>
      {loading && <Spinner className={styles.spinner} />}
    </button>
  );
}
```

`web/src/ui/Button.module.css`:

```css
.button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--control-height);
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: var(--leading-sm);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--duration),
    border-color var(--duration),
    color var(--duration);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.button[aria-busy="true"] {
  cursor: progress;
  opacity: 1;
}

.label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

/* label keeps its width while hidden so the button never resizes */
.button[aria-busy="true"] .label {
  visibility: hidden;
}

.spinner {
  position: absolute;
  inset: 0;
  margin: auto;
}

.primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
  color: var(--color-on-accent);
}

.secondary {
  background: var(--color-surface-raised);
  border-color: var(--color-border);
  color: var(--color-text);
}

.secondary:hover:not(:disabled) {
  border-color: var(--color-text-muted);
  color: var(--color-text);
}

.ghost {
  background: transparent;
  color: var(--color-text-muted);
}

.ghost:hover:not(:disabled) {
  background: var(--color-surface-raised);
  color: var(--color-text);
}
```

- [ ] **Step 4: Write Card, fields, and Skeleton**

`web/src/ui/Card.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./Card.module.css";
import { cx } from "./cx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.card, className)}>{children}</div>;
}
```

`web/src/ui/Card.module.css`:

```css
.card {
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}
```

`web/src/ui/TextField.tsx`:

```tsx
import { type InputHTMLAttributes, useId } from "react";
import styles from "./Field.module.css";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, ...rest }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
```

`web/src/ui/TextArea.tsx`:

```tsx
import { type TextareaHTMLAttributes, useId } from "react";
import { cx } from "./cx";
import styles from "./Field.module.css";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  value: string;
  maxLength: number;
  error?: string;
}

export function TextArea({ label, value, maxLength, error, id, ...rest }: TextAreaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const counterId = `${inputId}-counter`;
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        <span id={counterId} className={styles.counter}>
          {value.length} / {maxLength}
        </span>
      </div>
      <textarea
        id={inputId}
        value={value}
        maxLength={maxLength}
        className={cx(styles.control, styles.textarea)}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(counterId, error && errorId)}
        {...rest}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
```

`web/src/ui/Field.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.labelRow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

.label {
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: var(--leading-sm);
}

.counter {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-xs);
}

.control {
  width: 100%;
  min-height: var(--control-height);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--text-base);
  line-height: var(--leading-base);
  transition: border-color var(--duration);
}

.control:hover {
  border-color: var(--color-text-muted);
}

.control:focus-visible {
  outline-offset: 0;
}

.control[aria-invalid="true"] {
  border-color: var(--color-danger);
}

.textarea {
  min-height: 8rem;
  resize: vertical;
}

.error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}
```

`web/src/ui/Skeleton.tsx`:

```tsx
import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string;
  height?: string;
}

export function Skeleton({ width = "100%", height = "var(--leading-base)" }: SkeletonProps) {
  return <span aria-hidden className={styles.skeleton} style={{ width, height }} />;
}
```

`web/src/ui/Skeleton.module.css`:

```css
.skeleton {
  display: block;
  background: var(--color-surface-raised);
  border-radius: var(--radius);
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}
```

- [ ] **Step 5: Write Notice, PageHeader, Pagination, and SegmentedControl**

`web/src/ui/Notice.tsx`:

```tsx
import type { ReactNode } from "react";
import { errorMessage } from "../api/client";
import { Button } from "./Button";
import styles from "./Notice.module.css";

interface NoticeProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  role?: "status" | "alert";
}

export function Notice({ title, children, action, role = "status" }: NoticeProps) {
  return (
    <div role={role} className={styles.notice}>
      <p className={styles.title}>{title}</p>
      {children && <p className={styles.body}>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Notice
      role="alert"
      title="Something went wrong"
      action={onRetry && <Button onClick={onRetry}>Try again</Button>}
    >
      {errorMessage(error)}
    </Notice>
  );
}
```

`web/src/ui/Notice.module.css`:

```css
.notice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.title {
  font-weight: 600;
}

.body {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}
```

`web/src/ui/PageHeader.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, eyebrow, meta, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <title>{`${title} | TrackmyTracks`}</title>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1>{title}</h1>
        {meta && <div className={styles.meta}>{meta}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
```

React 19 hoists the `<title>` element into `<head>`.

`web/src/ui/Pagination.tsx`:

```tsx
import { Button } from "./Button";
import styles from "./Pagination.module.css";

interface PaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pages, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className={styles.pagination}>
      <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className={styles.status}>
        Page {page} of {pages}
      </span>
      <Button variant="ghost" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </nav>
  );
}
```

`web/src/ui/Pagination.module.css`:

```css
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-8);
}

.status {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-sm);
}
```

`web/src/ui/SegmentedControl.tsx`:

```tsx
import styles from "./SegmentedControl.module.css";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={styles.group}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          className={styles.segment}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

`web/src/ui/SegmentedControl.module.css`:

```css
.group {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.segment {
  height: var(--space-8);
  padding: 0 var(--space-4);
  background: transparent;
  border: 0;
  border-radius: var(--radius);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: var(--leading-sm);
  cursor: pointer;
  transition:
    background-color var(--duration),
    color var(--duration);
}

.segment:hover {
  color: var(--color-text);
}

.segment[aria-pressed="true"] {
  background: var(--color-surface-raised);
  color: var(--color-text);
}
```

`web/src/ui/PageHeader.module.css`:

```css
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.eyebrow {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: var(--leading-xs);
  text-transform: uppercase;
}

.meta {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/ui/components.test.tsx`
Expected: 8 passed

- [ ] **Step 7: Commit**

```bash
git add web/src/ui
git commit -m "feat(web): add core ui components"
```

### Task 5: Stars

**Files:**
- Create: `web/src/ui/Stars.tsx`, `web/src/ui/Stars.module.css`, `web/src/ui/index.ts`
- Test: `web/src/ui/Stars.test.tsx`

**Interfaces:**
- Consumes: tokens, `cx`, `formatAverage`
- Produces: `Stars({value: number | null, label: string, onChange?: (stars: number) => void, size?: "sm" | "md"})`. Without `onChange` it is an image showing decimal fill like 3.7. With `onChange` it is a slider that picks half stars by pointer or arrow keys. The `src/ui/index.ts` barrel exports every component.

- [ ] **Step 1: Write the failing tests**

`web/src/ui/Stars.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Stars } from "./Stars";

describe("Stars", () => {
  it("describes a decimal average", () => {
    render(<Stars value={3.7} label="Community rating" />);

    expect(screen.getByRole("img", { name: "Community rating: 3.7 out of 5" })).toBeInTheDocument();
  });

  it("describes a missing rating", () => {
    render(<Stars value={null} label="Community rating" />);

    expect(screen.getByRole("img", { name: "Community rating: not rated" })).toBeInTheDocument();
  });

  it("steps by half stars from the keyboard", async () => {
    const onChange = vi.fn();
    render(<Stars value={3} label="Your rating" onChange={onChange} />);

    screen.getByRole("slider", { name: "Your rating" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{End}");

    expect(onChange.mock.calls).toEqual([[3.5], [5]]);
  });

  it("starts at half a star when unrated", async () => {
    const onChange = vi.fn();
    render(<Stars value={null} label="Your rating" onChange={onChange} />);

    screen.getByRole("slider").focus();
    await userEvent.keyboard("{ArrowLeft}");

    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("picks the half star under the pointer", () => {
    const onChange = vi.fn();
    render(<Stars value={null} label="Your rating" onChange={onChange} />);
    const slider = screen.getByRole("slider");
    slider.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;

    fireEvent.click(slider, { clientX: 71 });

    expect(onChange).toHaveBeenCalledWith(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/Stars.test.tsx`
Expected: FAIL, cannot resolve `./Stars`

- [ ] **Step 3: Write the implementation**

`web/src/ui/Stars.tsx`:

```tsx
import { type KeyboardEvent, type MouseEvent, useState } from "react";
import { cx } from "./cx";
import { formatAverage } from "./format";
import styles from "./Stars.module.css";

const STAR_PATH = "M12 2l2.9 6.26 6.9.74-5.13 4.66 1.43 6.79L12 17.27 5.9 20.45l1.43-6.79L2.2 9l6.9-.74z";

const KEY_STEPS: Record<string, (current: number) => number> = {
  ArrowRight: (current) => current + 0.5,
  ArrowUp: (current) => current + 0.5,
  ArrowLeft: (current) => current - 0.5,
  ArrowDown: (current) => current - 0.5,
  Home: () => 0.5,
  End: () => 5,
};

interface StarsProps {
  value: number | null;
  label: string;
  onChange?: (stars: number) => void;
  size?: "sm" | "md";
}

function clamp(stars: number): number {
  return Math.min(5, Math.max(0.5, stars));
}

function StarRow({ className }: { className: string }) {
  return (
    <span className={cx(styles.row, className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={styles.star} aria-hidden>
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

export function Stars({ value, label, onChange, size = "md" }: StarsProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value ?? 0;
  const className = cx(styles.stars, styles[size], onChange && styles.interactive);
  const body = (
    <>
      <StarRow className={styles.empty} />
      <span className={styles.fill} style={{ width: `${(shown / 5) * 100}%` }}>
        <StarRow className={styles.filled} />
      </span>
    </>
  );

  if (!onChange) {
    const description = value === null ? "not rated" : `${formatAverage(value)} out of 5`;
    return (
      <span role="img" aria-label={`${label}: ${description}`} className={className}>
        {body}
      </span>
    );
  }

  const starsAt = (event: MouseEvent<HTMLSpanElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return clamp(Math.ceil(((event.clientX - rect.left) / rect.width) * 10) / 2);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    onChange(clamp(step(value ?? 0)));
  };

  return (
    <span
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? "Not rated" : `${value} out of 5 stars`}
      className={className}
      onPointerMove={(event) => setPreview(starsAt(event))}
      onPointerLeave={() => setPreview(null)}
      onClick={(event) => onChange(starsAt(event))}
      onKeyDown={handleKeyDown}
    >
      {body}
    </span>
  );
}
```

`web/src/ui/Stars.module.css`:

```css
.stars {
  position: relative;
  display: inline-flex;
  flex: none;
}

.sm {
  --star-size: var(--space-4);
}

.md {
  --star-size: var(--space-6);
}

.interactive {
  cursor: pointer;
  border-radius: var(--radius);
}

.row {
  display: flex;
}

/* fixed size so the clipped fill row never squeezes its stars */
.star {
  flex: none;
  width: var(--star-size);
  height: var(--star-size);
  max-width: none;
  fill: currentColor;
}

.empty {
  color: var(--color-text-muted);
  opacity: 0.3;
}

.filled {
  color: var(--color-accent);
}

.fill {
  position: absolute;
  inset: 0 auto 0 0;
  overflow: hidden;
  pointer-events: none;
}
```

`web/src/ui/index.ts`:

```ts
export { Button, buttonClassName } from "./Button";
export { Card } from "./Card";
export { cx } from "./cx";
export { formatAverage, formatDate, formatDuration, pluralize } from "./format";
export { ErrorNotice, Notice } from "./Notice";
export { PageHeader } from "./PageHeader";
export { Pagination } from "./Pagination";
export { SegmentedControl } from "./SegmentedControl";
export { Skeleton } from "./Skeleton";
export { Spinner } from "./Spinner";
export { Stars } from "./Stars";
export { TextArea } from "./TextArea";
export { TextField } from "./TextField";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/Stars.test.tsx`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add web/src/ui
git commit -m "feat(web): add half star rating control"
```

### Task 6: App shell and router

**Files:**
- Create: `web/src/app/App.tsx`, `web/src/app/router.ts`, `web/src/app/AppShell.tsx`, `web/src/app/AppShell.module.css`, `web/src/app/NotFoundPage.tsx`
- Create: `web/src/features/auth/routes.ts`, `web/src/features/catalog/routes.ts`, `web/src/features/history/routes.ts`, `web/src/features/playlists/routes.ts`
- Create: `web/src/test/render.tsx`
- Modify: `web/src/main.tsx`
- Test: `web/src/app/router.test.tsx`

**Interfaces:**
- Consumes: `ui`, `queryClient`
- Produces:
  - `routes: RouteObject[]` and `router`
  - `authRoutes`, `catalogRoutes`, `historyRoutes`, `playlistsRoutes`, each `RouteObject[]` that its slice fills
  - `AppShell` with a header bar where slice 05 mounts `AccountNav` after the `nav` element
  - `renderWithProviders(ui, {path?})` that renders one element inside providers with a memory router, and `renderAt(path)` that renders the full app at a path. Both return the Testing Library result plus `queryClient`

Route files use `.ts` with `Component:` so they hold no JSX. That keeps the React Refresh lint rule quiet.

- [ ] **Step 1: Write the test helpers and failing test**

`web/src/test/render.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routes } from "../app/router";

function renderRouter(routeObjects: RouteObject[], path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, queryClient, router };
}

export function renderWithProviders(ui: ReactElement, { path = "/" } = {}) {
  return renderRouter([{ path: "*", element: ui }], path);
}

export function renderAt(path: string) {
  return renderRouter(routes, path);
}
```

`web/src/app/router.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../test/fetch";
import { renderAt } from "../test/render";

describe("router", () => {
  it("shows not found for unknown paths inside the shell", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    renderAt("/no-such-page");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "TrackmyTracks" })).toHaveAttribute("href", "/search");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/router.test.tsx`
Expected: FAIL, cannot resolve `../app/router`

- [ ] **Step 3: Write the shell and router**

Each feature routes file starts empty and its slice fills it.

`web/src/features/auth/routes.ts`:

```ts
import type { RouteObject } from "react-router";

export const authRoutes: RouteObject[] = [];
```

`web/src/features/catalog/routes.ts`:

```ts
import type { RouteObject } from "react-router";

export const catalogRoutes: RouteObject[] = [];
```

`web/src/features/history/routes.ts`:

```ts
import type { RouteObject } from "react-router";

export const historyRoutes: RouteObject[] = [];
```

`web/src/features/playlists/routes.ts`:

```ts
import type { RouteObject } from "react-router";

export const playlistsRoutes: RouteObject[] = [];
```

`web/src/app/router.ts`:

```ts
import { createBrowserRouter, type RouteObject } from "react-router";
import { authRoutes } from "../features/auth/routes";
import { catalogRoutes } from "../features/catalog/routes";
import { historyRoutes } from "../features/history/routes";
import { playlistsRoutes } from "../features/playlists/routes";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";

export const routes: RouteObject[] = [
  {
    Component: AppShell,
    children: [
      ...authRoutes,
      ...catalogRoutes,
      ...historyRoutes,
      ...playlistsRoutes,
      { path: "*", Component: NotFoundPage },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

`web/src/app/AppShell.tsx`:

```tsx
import { Link, NavLink, Outlet } from "react-router";
import { cx } from "../ui";
import styles from "./AppShell.module.css";

const navClassName = ({ isActive }: { isActive: boolean }) => cx(styles.link, isActive && styles.active);

export function AppShell() {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <nav className={styles.nav} aria-label="Main">
            <Link to="/search" className={styles.brand}>
              TrackmyTracks
            </Link>
            <NavLink to="/search" className={navClassName}>
              Search
            </NavLink>
          </nav>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  );
}
```

`web/src/app/AppShell.module.css`:

```css
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  max-width: var(--content-width);
  margin: 0 auto;
  padding: var(--space-3) var(--space-6);
}

.nav {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.brand {
  font-family: var(--font-heading);
  font-size: var(--text-lg);
  font-weight: 600;
  line-height: var(--leading-lg);
}

.link {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: var(--leading-sm);
}

.active {
  color: var(--color-text);
}

.main {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6) var(--space-16);
}

@media (max-width: 640px) {
  .bar {
    padding: var(--space-3) var(--space-4);
  }

  .main {
    padding: var(--space-6) var(--space-4) var(--space-12);
  }
}
```

`web/src/app/NotFoundPage.tsx`:

```tsx
import { Link } from "react-router";
import { buttonClassName, Notice, PageHeader } from "../ui";

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Notice
        title="Nothing lives at this address"
        action={
          <Link to="/search" className={buttonClassName("primary")}>
            Search music
          </Link>
        }
      >
        The link may be broken, or the page may have moved.
      </Notice>
    </>
  );
}
```

`web/src/app/App.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router/dom";
import { queryClient } from "../api/queryClient";
import { router } from "./router";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

Replace `web/src/main.tsx`:

```tsx
import "@fontsource-variable/fraunces";
import "@fontsource-variable/public-sans";
import "./ui/tokens.css";
import "./ui/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Run every check**

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, lint reports no errors, and the build succeeds.

- [ ] **Step 5: See it in the browser**

Run: `npm run dev` and open `http://localhost:5173/anything`
Expected: dark page, sticky header with the serif TrackmyTracks wordmark and Search link, a "Page not found" heading, and an amber "Search music" button. The tab reads "Page not found | TrackmyTracks". At 375px wide the padding tightens and nothing overflows.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat(web): add app shell, router, and test render helpers"
```

### Task 7: Web continuous integration

**Files:**
- Create: `.github/workflows/web.yml`

**Interfaces:**
- Consumes: everything above
- Produces: a `web` check on every pull request

- [ ] **Step 1: Write the workflow**

`.github/workflows/web.yml`:

```yaml
name: web

on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Commit, push, and open the pull request**

```bash
git add .github/workflows/web.yml
git commit -m "ci: run web lint, tests, and build"
git push -u origin slice/03-web-foundation
gh pr create --fill --base main
```

Expected: the `web` check goes green. Add `web / check` to the required checks on `main`.

### Task 8: README web setup

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1
- Produces: the web setup steps later slices rely on

- [ ] **Step 1: Add the web section to `README.md`**

Insert before the Earlier prototype section, so it lands after the API section whichever slice merges first:

````markdown
### Web

Requires Node 22 or newer. The web app runs in its own terminal from `web/`, next to the API terminal.

```bash
cd web
npm install      # first time only
npm run dev      # http://localhost:5173, open this one
```

Vite proxies `/api` to Flask, so the browser only ever talks to port 5173. Run the web tests with `npm test` from `web/`.
````

- [ ] **Step 2: Verify the steps from a fresh terminal**

Run the block above in a new terminal.
Expected: `npm run dev` serves on port 5173, and `npm test` passes after stopping it.

- [ ] **Step 3: Commit and push**

```bash
git add README.md
git commit -m "docs: add web setup to the readme"
git push
```
