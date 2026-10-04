# Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khadijah's prototype homepage becomes the `web/` landing page at `/`, restyled in the slice 03 design system with static sample data.

**Architecture:** A new `features/home` folder contributes `homeRoutes` to the router the same way every feature does. The page is three sections built from `src/ui` components, reading one sample data module shaped like the API types. The app shell gains her footer and its brand links home.

**Tech Stack:** Vite, React 19, TypeScript, React Router 7, CSS Modules, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/002-home-page-design.md`

**Branch:** `feature/home-page`, already created from `slice/03-web-foundation`.

## Global Constraints

- Frontend uses only `src/ui/` components and tokens from `src/ui/tokens.css`, no ad hoc colors, spacing, or radii
- Spacing uses the 4 point scale tokens, one radius token `--radius` for every bordered component
- One heading font (Fraunces) and one body font (Public Sans), amber only for stars and primary actions
- Nothing moves on hover, `--duration` color and border transitions only
- Code comments follow CLAUDE.md, brief, ASCII, no trailing period on one liners, no semicolons or dashes
- Before every commit run `npm run lint` in `web/`, 0 errors and 0 warnings
- Every commit adds the paths it creates or modifies to `claude-files.txt`, sorted from line 3, and ends with both trailers:
  `Co-authored-by: Khadijah Naeem <khadiju2004@gmail.com>` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Her copy is kept word for word, `frontend/` is not modified

## Review Focus

1. Search text with spaces, slashes, or ampersands like `AC/DC & co` arrives on `/search` as the same `q` value. Test in Task 2.
2. Whitespace only search text stays on `/` instead of searching for spaces. Test in Task 2.
3. Pressing Enter in the field submits, not only clicking the button. Test in Task 2.
4. A long unbroken word in a review or title wraps inside its card at 375px instead of widening the page. CSS in Task 3, checked in its browser step.
5. Opening `/` after another page leaves the tab reading TrackmyTracks. Test in Task 2.

---

### Task 1: Shell footer, home brand link, and hidden labels

**Files:**
- Modify: `web/src/app/AppShell.tsx`, `web/src/app/AppShell.module.css`
- Modify: `web/src/ui/global.css`, `web/src/ui/TextField.tsx`
- Test: `web/src/app/router.test.tsx`, `web/src/ui/components.test.tsx`

**Interfaces:**
- Consumes: `cx`, `renderAt`, `mockFetch`
- Produces:
  - global class `visually-hidden` in `global.css`, hides content visually but keeps it for assistive tech
  - `TextField({label, hideLabel?, error?, ...inputProps})`, `hideLabel` adds `visually-hidden` to the label
  - `AppShell` brand `Link` points to `/`, and a `<footer>` follows `main`

- [ ] **Step 1: Write the failing tests**

In `router.test.tsx`, change the brand expectation to `toHaveAttribute("href", "/")` and add:

```tsx
it("closes every page with the footer", async () => {
  mockFetch({ "GET /api/auth/me": { body: { user: null } } });
  renderAt("/no-such-page");

  expect(await screen.findByRole("contentinfo")).toHaveTextContent("Rate it. Review it. Replay it.");
});
```

In `components.test.tsx` add:

```tsx
it("keeps a hidden text field label accessible", () => {
  render(<TextField label="Search music" hideLabel />);

  expect(screen.getByLabelText("Search music")).toBeInTheDocument();
  expect(screen.getByText("Search music")).toHaveClass("visually-hidden");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/router.test.tsx src/ui/components.test.tsx`
Expected: FAIL on the brand href, the missing `contentinfo`, and the missing class

- [ ] **Step 3: Implement**

- `global.css`: add `.visually-hidden` with the standard clip pattern (`position: absolute`, `width: 1px`, `height: 1px`, `overflow: hidden`, `clip-path: inset(50%)`, `white-space: nowrap`)
- `TextField.tsx`: destructure `hideLabel`, label `className={cx(styles.label, hideLabel && "visually-hidden")}`
- `AppShell.tsx`: brand `Link to="/"`, after `main` a `<footer className={styles.footer}>` holding a `div.bar`-width inner with `<p className={styles.footerBrand}>TrackmyTracks</p>` and `<p className={styles.tagline}>Rate it. Review it. Replay it.</p>`
- `AppShell.module.css`: `.footer` has `border-top: 1px solid var(--color-border)`. Its inner reuses the header bar's `max-width`, `margin`, and padding at both breakpoints. `.footerBrand` uses the `.brand` font settings, `.tagline` is `--color-text-muted` at `--text-sm`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/router.test.tsx src/ui/components.test.tsx`
Expected: 11 passed

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add web/src claude-files.txt
git commit -m "feat(web): add footer and home brand link to the shell"
```

### Task 2: Home route and search hero

**Files:**
- Create: `web/src/features/home/routes.ts`, `HomePage.tsx`, `HomePage.module.css`, `Hero.tsx`
- Modify: `web/src/app/router.ts`
- Test: `web/src/features/home/HomePage.test.tsx`

**Interfaces:**
- Consumes: `TextField` with `hideLabel`, `Button`, `Stars`, `visually-hidden` from Task 1, `renderAt`, `mockFetch`
- Produces:
  - `homeRoutes: RouteObject[]` = `[{ index: true, Component: HomePage }]`, no JSX in the routes file
  - `HomePage()` renders `<title>TrackmyTracks</title>`, `<h1 className="visually-hidden">TrackmyTracks</h1>`, then `Hero`. Task 3 appends the two sections
  - `HomePage.module.css` holds the page's layout classes, Task 3 adds to it

- [ ] **Step 1: Write the failing tests**

`HomePage.test.tsx`, each test calls `mockFetch({ "GET /api/auth/me": { body: { user: null } } })` first:

```tsx
it("renders the home page at the root", async () => {
  renderAt("/");

  expect(await screen.findByRole("heading", { level: 1, name: "TrackmyTracks" })).toBeInTheDocument();
  expect(screen.getByRole("search")).toBeInTheDocument();
  expect(document.title).toBe("TrackmyTracks");
});

it("searches from the hero", async () => {
  const { router } = renderAt("/");

  await userEvent.type(await screen.findByLabelText("Search music"), "AC/DC & co");
  await userEvent.click(screen.getByRole("button", { name: "Search" }));

  expect(router.state.location.pathname).toBe("/search");
  expect(new URLSearchParams(router.state.location.search).get("q")).toBe("AC/DC & co");
});

it("submits with the enter key", async () => {
  const { router } = renderAt("/");

  await userEvent.type(await screen.findByLabelText("Search music"), "radiohead{Enter}");

  expect(new URLSearchParams(router.state.location.search).get("q")).toBe("radiohead");
});

it("ignores a blank search", async () => {
  const { router } = renderAt("/");

  await userEvent.type(await screen.findByLabelText("Search music"), "   {Enter}");

  expect(router.state.location.pathname).toBe("/");
});

it("restores the tab title after another page", async () => {
  const { router } = renderAt("/no-such-page");
  await screen.findByRole("heading", { name: "Page not found" });

  await router.navigate("/");

  expect(await screen.findByRole("heading", { level: 1, name: "TrackmyTracks" })).toBeInTheDocument();
  expect(document.title).toBe("TrackmyTracks");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/home/HomePage.test.tsx`
Expected: FAIL, cannot resolve or `/` renders Page not found

- [ ] **Step 3: Implement**

- `routes.ts` and `HomePage.tsx` per the Interfaces block. `router.ts` spreads `...homeRoutes` first in the shell's children
- `Hero.tsx`: `<form role="search">` with `TextField label="Search music" hideLabel placeholder="Search songs, albums, or artists"` and `Button variant="primary" type="submit"` "Search". On submit, `preventDefault`, trim, return when empty, else `navigate({ pathname: "/search", search: \`?${new URLSearchParams({ q })}\` })`
- Under the form, her three blurbs in a list: "Rate your favorites" with `Stars value={5} label="Five stars" size="sm"`, "Discover new music", "Write your reviews"
- `HomePage.module.css`: page sections stacked with `--space-16` gaps. The form is a row, field growing, button fixed, stacking under 640px. Blurbs are a 3 column row, 1 column under 640px, muted `--text-sm`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/home/HomePage.test.tsx`
Expected: 5 passed

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add web/src claude-files.txt
git commit -m "feat(web): add home page route with search hero"
```

### Task 3: Sample data, Trending Tracks, and Fresh Reviews

**Files:**
- Create: `web/src/features/home/sampleData.ts`, `SectionHeading.tsx`, `TrendingTracks.tsx`, `FreshReviews.tsx`
- Modify: `web/src/features/home/HomePage.tsx`, `HomePage.module.css`
- Test: `web/src/features/home/HomePage.test.tsx`

**Interfaces:**
- Consumes: `SongSummary`, `CommunityRating`, `Review` from `src/api/types`, `Card`, `Stars`, `formatAverage`, `HomePage` from Task 2
- Produces:
  - `TrendingTrack { song: SongSummary; community: CommunityRating }` and `RecentReview { review: Review; song: SongSummary; posted: string }`
  - `TRENDING: TrendingTrack[]`, `REVIEWS: RecentReview[]`
  - `SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string })`

- [ ] **Step 1: Write the failing tests**

Add to `HomePage.test.tsx`:

```tsx
it("shows trending tracks with community ratings", async () => {
  renderAt("/");

  const trending = await screen.findByRole("region", { name: "Trending Tracks" });
  for (const title of ["Midnight Drive", "After Hours", "Electric Blue", "Replay"]) {
    expect(within(trending).getByText(title)).toBeInTheDocument();
  }
  expect(within(trending).getByRole("img", { name: "Community rating: 4.4 out of 5" })).toBeInTheDocument();
});

it("shows fresh reviews from the community", async () => {
  renderAt("/");

  const reviews = await screen.findByRole("region", { name: "Fresh Reviews" });
  expect(within(reviews).getByText("@khadijah")).toBeInTheDocument();
  expect(within(reviews).getByText("Exactly what I want from a late-night playlist.")).toBeInTheDocument();
  expect(within(reviews).getAllByRole("img", { name: /^Rating: / })).toHaveLength(3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/home/HomePage.test.tsx`
Expected: 2 failed, no region named Trending Tracks or Fresh Reviews

- [ ] **Step 3: Write `sampleData.ts`**

Songs are defined once and shared. Artist and song MBIDs are fixed placeholder UUIDs, `disambiguation` and `length_ms` are null.

| Song | Artist | Trending stars |
|---|---|---|
| Midnight Drive | Neon Avenue | 4.4 |
| After Hours | Static Dreams | 4.8 |
| Electric Blue | Night Shift | 4.2 |
| Replay | Echo Room | 4.7 |

`community.count` is omitted from display, set it to 0.

| User | Posted | Stars | Song | Review |
|---|---|---|---|---|
| khadijah | just now | 5 | Midnight Drive | This is one of those songs you immediately want to replay the second it ends. |
| sam | 12 min ago | 4 | Electric Blue | The production is insane. Easily one of my favorite tracks from the album. |
| eyan | 28 min ago | 5 | Replay | Exactly what I want from a late-night playlist. |

Review `id` is 1 to 3, `updated_at` is `"2026-10-03T00:00:00+00:00"` for all three.

- [ ] **Step 4: Write the sections**

- `SectionHeading`: eyebrow paragraph styled like `PageHeader`'s eyebrow, then `<h2 id={id}>`. Each section calls `useId()` and renders `<section aria-labelledby={id}>` so the section is a region named by its heading
- `TrendingTracks`: eyebrow "WHAT'S PLAYING", title "Trending Tracks". An ordered list of `Card`s. Each card has a square cover on `--color-surface-raised` with `--radius` holding the two digit position ("01") in Fraunces at `--text-2xl`, an `h3` title, the artist in muted `--text-sm`, then `Stars value={community.stars} label="Community rating" size="sm"` beside `formatAverage(stars)`
- `FreshReviews`: eyebrow "THE COMMUNITY", title "Fresh Reviews". A list of `Card`s. Each card has a `--space-8` square avatar on `--color-surface-raised` with `--radius` holding the uppercase first letter, `@username` in bold and `posted` muted, `Stars value={stars} label="Rating" size="sm"`, an `h3` song title, the artist muted, and the review text
- `HomePage.tsx` renders `Hero`, `TrendingTracks`, `FreshReviews` in that order
- Grid columns: trending 4, then 2 under 960px, then 1 under 640px. Reviews 3, then 1 under 640px. Card text uses `overflow-wrap: anywhere` and grid items `min-width: 0`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/home/HomePage.test.tsx`
Expected: 7 passed

- [ ] **Step 6: Check every suite and the browser**

Run: `npm test`, `npm run lint`, `npm run build`
Expected: all pass, lint prints nothing

Run: `npm run dev` and open `http://localhost:5173/`
Expected: search form first, three blurbs, four track cards, three review cards, footer. At 375px everything is one column and nothing scrolls sideways.

- [ ] **Step 7: Commit**

```bash
git add web/src claude-files.txt
git commit -m "feat(web): add trending tracks and fresh reviews to the home page"
```

### Task 4: Plan contract updates

**Files:**
- Modify: `docs/superpowers/plans/001-local-prototype.md`
- Modify: `docs/superpowers/plans/001-local-prototype/06-catalog-pages.md`

**Interfaces:**
- Consumes: `homeRoutes` from Task 2
- Produces: slice 06 no longer owns `/`

- [ ] **Step 1: Update the index**

- Routes line: "`/` redirects to `/search`" becomes "`/` home page (002)"
- Frontend modules table: add the row `| \`src/features/home/routes.ts\` | 002 | \`homeRoutes\`, the landing page at \`/\` |`

- [ ] **Step 2: Update slice 06**

- Task 4 Interfaces: "Routes `/` redirecting to `/search`, and `/search?q=&type=&page=`" becomes "Route `/search?q=&type=&page=`, `/` belongs to the home page from plan 002"
- Task 4 tests: delete the "redirects the home page to search" test, its expected count goes from 9 passed to 8 passed
- Task 4 and Task 5 `routes.ts` listings: delete `{ index: true, loader: () => redirect("/search") },` and change the import to `import type { RouteObject } from "react-router";`

- [ ] **Step 3: Verify nothing still claims `/`**

Run: `grep -n 'redirect("/search")\|redirects the home page' docs/superpowers/plans -r`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans claude-files.txt
git commit -m "docs: hand the root route to the home page"
```
