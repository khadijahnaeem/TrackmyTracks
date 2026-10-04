# 002 Home Page Design

Khadijah's `frontend/` prototype homepage moves into `web/` as the landing page at `/`. It keeps her sections, wording, and sample content, restyled in the slice 03 design system. It is visual for now: the trending and review sections read static sample data until the API grows routes for them.

## Goals

1. Opening `http://localhost:5173/` shows the home page inside the app shell
2. Submitting the search form goes to `/search?q=<text>`, the route slice 06 builds
3. Trending Tracks shows her 4 tracks and Fresh Reviews shows her 3 reviews, word for word
4. Every page gets her footer
5. The page uses only `src/ui/` components and tokens, so it reads as part of the same app as every other page

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Route | Landing page at `/`, slice 06 drops its `/` to `/search` redirect | The homepage is the front door, search stays one click away |
| Styling | Slice 03 tokens, Fraunces and Public Sans, one `--radius`, amber only for stars and primary actions | Global Constraints in the plan index, one design language |
| Hero statement | Removed. The page leads with the search form, a visually hidden `h1` reads TrackmyTracks and a `<title>` sets the tab to TrackmyTracks | Requested, every page still needs one `h1` and a title |
| Sample data | One `sampleData.ts` shaped like the API types | Wiring the API later swaps one import, not the components |
| Dropped pieces | Glows, gradient covers, hover lift, play button, featured card, "View all" and "More reviews" links, navbar links | Off the token system, or controls with nothing behind them |
| Feature blurbs | Removed, the search form sits directly above Trending Tracks | Requested after review, the row floated without a column to align to |
| `frontend/` | Stays in this PR | Removed later by the team |
| Credit | Commits carry `Co-authored-by: Khadijah Naeem <khadiju2004@gmail.com>` | The page is her design |
| Branch | `feature/home-page` from `slice/03-web-foundation`, its own PR after slice 03 merges | Keeps slice 03 one PR |

## Architecture

```
web/src/
  features/home/
    routes.ts             homeRoutes = [{ index: true, Component: HomePage }]
    HomePage.tsx          hidden h1, Hero, TrendingTracks, FreshReviews
    HomePage.module.css   page and section layout
    Hero.tsx              search form
    TrendingTracks.tsx    section heading and track grid
    FreshReviews.tsx      section heading and review grid
    SectionHeading.tsx    eyebrow plus h2, shared by both sections
    sampleData.ts         TRENDING and REVIEWS
    HomePage.test.tsx
  app/
    router.ts             composes homeRoutes first
    AppShell.tsx          brand links to /, footer added
    AppShell.module.css   footer styles
    router.test.tsx       brand href is /, / renders the home page
```

Sections that share styles keep them in `HomePage.module.css` so the feature has one stylesheet.

### Sample data

Shaped from `src/api/types.ts` so a later API route can return the same shapes:

```ts
interface TrendingTrack {
  song: SongSummary;
  community: CommunityRating;
}

interface RecentReview {
  review: Review;
  song: SongSummary;
  posted: string;
}
```

`posted` holds her relative times ("just now", "12 min ago", "28 min ago") as display text, since the sample has no real timestamps. MBIDs are fixed placeholder UUIDs. Her star strings become numbers: 4.4, 4.8, 4.2, 4.7 for tracks, and 5, 4, 5 for reviews. `disambiguation` and `length_ms` are null.

## Sections

### Hero

- A `<form role="search">` with a `TextField` labelled "Search music" (label visually hidden), placeholder "Search songs, albums, or artists", and a primary `Button` "Search"
- Submitting trimmed text navigates to `/search?q=<encoded text>`, empty text does nothing
### Trending Tracks

- `SectionHeading` with eyebrow "WHAT'S PLAYING" and `h2` "Trending Tracks"
- A grid of `Card`s, 4 columns on desktop, 2 under 960px, 1 under 640px
- Each card has a square cover on `--color-surface-raised` with the track number ("01" to "04") in Fraunces, the title, the artist in muted text, `Stars` (`size="sm"`, label "Community rating") and the average from `formatAverage`

### Fresh Reviews

- `SectionHeading` with eyebrow "THE COMMUNITY" and `h2` "Fresh Reviews"
- A grid of `Card`s, 3 columns on desktop, 1 under 640px
- Each card has an initial avatar on `--color-surface-raised` with `--radius`, `@username` and the posted text, `Stars` (`size="sm"`, label "Rating"), the song title, the artist in muted text, and the review text

### Footer

In `AppShell`, below `main`: a top border, "TrackmyTracks" in Fraunces, and her line "Rate it. Review it. Replay it." in muted text. Content width and padding match the header bar.

## Plan updates in this PR

- Plan index Routes line: "`/` redirects to `/search`" becomes "`/` home page (002)"
- Plan index Frontend modules: add `src/features/home/routes.ts` providing `homeRoutes`
- Slice 06 Task 4: drop the `{ index: true, loader: () => redirect("/search") }` route and the "redirects the home page to search" test, its expected count goes from 9 to 8, and its interface line drops "Routes `/` redirecting to `/search`"
- Slice 06 Task 5: drop the same redirect line from its `routes.ts` listing, `redirect` is no longer imported

Dev 2 owns slice 06 and needs a heads up.

## Testing

`HomePage.test.tsx`, using `renderAt("/")` and `mockFetch` for `GET /api/auth/me`:

1. The page renders inside the shell with the hidden "TrackmyTracks" `h1`
2. Submitting "radiohead" navigates to `/search` with `q=radiohead`
3. Submitting blank text stays on `/`
4. All 4 trending titles and all 3 review texts render
5. Ratings are described, like "Community rating: 4.4 out of 5"

`router.test.tsx` changes its brand link expectation to `/`.

`npm run lint`, `npm test`, and `npm run build` pass. At 375px nothing overflows.

## Out of scope

- API routes for trending and recent reviews, and wiring the sections to them
- Linking cards to song pages, which slice 06 builds
- Removing `frontend/` and `css/`
