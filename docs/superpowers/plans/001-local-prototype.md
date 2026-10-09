# 001 Local Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each slice plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TrackmyTracks prototype described in the spec so it runs locally with three commands.

**Architecture:** Flask API with one Blueprint per feature over Postgres 16, React SPA served by Vite that proxies `/api` to Flask. MusicBrainz and ListenBrainz data is cached into Postgres on first touch. Effective album and artist ratings come from SQL views.

**Tech Stack:** Python 3.12, Flask 3.1, Flask-SQLAlchemy 3.1, Flask-Migrate 4, psycopg 3, requests, pytest, responses, ruff. Node 22, Vite, React 19, TypeScript, React Router 7, TanStack Query 5, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/001-local-prototype-design.md`

This file is the index. The work is split into ten slices, each a self-contained plan that one person runs in one session. Read this file first, then the slice you own. Every slice inherits the Global Constraints and Contracts below.

## Slices

| # | Plan | Owner | Day | Depends on | Phase |
|---|---|---|---|---|---|
| 01 | [Dev environment](001-local-prototype/01-dev-environment.md) | Dev 4 | 1 | nothing | done |
| 02 | [API foundation](001-local-prototype/02-api-foundation.md) | Dev 1 | 1 | 01 | done |
| 03 | [Web foundation](001-local-prototype/03-web-foundation.md) | Dev 2 | 1 | nothing | done |
| 04 | [Music catalog service](001-local-prototype/04-music-catalog.md) | Dev 3 | 1 to 2 | nothing for Task 1, 02 Task 1 for Tasks 2 and 3, 02 for Tasks 4 and 5 | done |
| 11 | [Mock API](003-ui-first.md) Tasks 2 to 6 | Dev 2 | 2 | 03 | A0 |
| 05 | [Auth](001-local-prototype/05-auth.md) | Dev 1 | 2 | 02, 03 | A1 web tasks, B API tasks |
| 06 | [Catalog pages](001-local-prototype/06-catalog-pages.md) | Dev 2 | 2 to 4 | 04, then 07 Task 3 and 08 Task 3 for the page tasks | A1 web tasks, B API tasks |
| 07 | [Ratings and reviews](001-local-prototype/07-ratings-reviews.md) | Dev 3 | 2 to 4 | 04, 05 Task 1 | A1 web tasks, B API tasks |
| 08 | [Playlists](001-local-prototype/08-playlists.md) | Dev 4 | 2 to 4 | 04, 05 Task 1 | A1 web tasks, B API tasks |
| 09 | [History](001-local-prototype/09-history.md) | Dev 1 | 3 to 4 | 02, 03 | A1 web tasks, B API tasks |
| 10 | [Integration](001-local-prototype/10-integration.md) | All | 6 to 7 | all | C |

The remaining work is built UI first. A0 is the browser mock API, A1 is every web task running against it, B is the API tasks built to the contract the finished pages use, and C is integration, which starts with [003](003-ui-first.md) Task 10 removing the mock. The Depends on column describes the API tasks, and the Day column is the original estimate from before the UI first order. Every web task depends on slice 11 instead, and keeps the web task order below.

```
A0  03 --> 11 Mock API
A1  11 --> 05 Tasks 2 to 4 --> 07 Task 3, 08 Task 3 --> 06 Tasks 4 and 5
                               08 Task 3 --> 08 Task 4
    11 --> 06 Task 3, 09 Task 2
B   02, 04 --> 05 Task 1 --> 06 Tasks 1 and 2, 07 Tasks 1 and 2, 08 Tasks 1 and 2, 09 Task 1
C   all --> 003 Task 10 --> 10
```

Web tasks run against `npm run dev:mock`. Any route or shape a page changes updates this index in the same pull request, and each B task is checked against this index and its handler file in `web/src/mocks/handlers/` before it runs.

Each slice is one branch named `slice/NN-name` and one pull request. Merge to `main` as soon as a slice's tasks pass review, since later slices build on it.

## Global Constraints

- Python 3.12, Node 22 or newer, Postgres 16 via `docker compose` on host port 5433, Flask on port 5001
- All API routes live under `/api` and return JSON, errors use `{"error": {"code", "message"}}`
- Error codes: `validation_error` 422, `unauthorized` 401, `not_found` 404, `conflict` 409, `catalog_unavailable` 502
- Ratings are half stars 0.5 to 5 on the wire, stored as `score` 1 to 10
- Averages are decimal stars rounded to one place, like 3.7
- Review max 2,000 characters, playlist name max 100, description max 500, playlist max 500 songs
- Text inputs are trimmed and an empty result is stored as NULL
- Timestamps go out as ISO 8601 strings from `isoformat()`, and an unknown username answers 404 `User not found`
- Username is 3 to 30 of `[a-z0-9_]`, password at least 8 characters
- Search pages hold 25 results, reviews and history pages hold 20
- Only `app/musicbrainz.py` calls external services, MusicBrainz requests are at least 1 second apart
- Tests never touch the network
- Frontend uses only `src/ui/` components and tokens from `src/ui/tokens.css`, no ad hoc colors, spacing, or radii
- Spacing uses the 4 point scale tokens, one radius token `--radius` for every bordered component
- One heading font (Fraunces) and one body font (Public Sans)
- Code comments follow CLAUDE.md, brief, ASCII, no trailing period on one liners, no semicolons or dashes
- Before every commit run `ruff format . && ruff check .` in `api/` or `npm run lint` in `web/`

## Review Focus

Five inputs the spec implies but no feature test would naturally hit. Each has a test in the owning slice.

1. Search text with Lucene syntax like `AC/DC` or `"quoted"` returns results instead of a 502. Test in 04 Task 3.
2. Two requests caching the same entity, or a double clicked rating, leave one row and no 500. Test in 04 Task 4 and 07 Task 1.
3. MusicBrainz answering a lookup with a merged, different MBID still loads the page. Test in 04 Task 4.
4. A whitespace only review is stored as NULL and never shows in the reviews feed. Test in 07 Task 1.
5. A session cookie for a user that no longer exists acts as logged out, not a 500. Test in 02 Task 4.

## Contracts

Slices run in parallel, so these names and shapes are fixed. Changing one means updating this file in the same pull request.

### Backend modules

| Module | Slice | Provides |
|---|---|---|
| `app/__init__.py` | 02 | `create_app(overrides: dict \| None = None) -> Flask` |
| `app/extensions.py` | 02 | `db`, `migrate` |
| `app/errors.py` | 02 | `ApiError`, `ValidationError`, `Unauthorized`, `NotFound`, `Conflict`, `CatalogUnavailable`, `register_error_handlers(app)` |
| `app/http.py` | 02 | `json_body()`, `required_text(data, field, max_length)`, `optional_text(data, field, max_length)`, `page_arg()`, `page_payload(items, page, total, per_page)`, `paginate(query, serialize, page, per_page=20)` |
| `app/models.py` | 02 | `User`, `Artist`, `Album`, `Song`, `AlbumSong`, `ArtistTopSong`, `Rating`, `Playlist`, `PlaylistSong` |
| `app/kinds.py` | 02 | `Kind = Literal["song", "album", "artist"]`, `KINDS`, `MODELS: dict[Kind, type]`, `kind_of(entity) -> Kind` |
| `app/views.py` | 02 | `EFFECTIVE_RATINGS: dict[Kind, Table]` |
| `app/ratings/queries.py` | 02 | `rating_summaries(user_id: int \| None, kind: Kind, target_ids: Iterable[int]) -> dict[int, dict]` |
| `app/auth/session.py` | 02 | `current_user() -> User \| None`, `require_user() -> User`, `log_in(user)`, `log_out()` |
| `app/catalog/serializers.py` | 02 | `artist_summary(x)`, `album_summary(x)`, `song_summary(x)`, `SUMMARIES: dict[Kind, Callable]` |
| `app/<feature>/routes.py` | 02 | `bp` Blueprint, already registered in `create_app` |
| `app/auth/serializers.py` | 05 Task 1 | `user_payload(user) -> User`, `public_user(user) -> PublicUser` |
| `app/history/routes.py` | 09 | `bp` Blueprint `history` at `/api`, registered by slice 09 in `create_app` |
| `app/musicbrainz.py` | 04 | `MusicBrainzClient` with `search_artists/search_albums/search_songs(query, page) -> SearchResults`, `musicbrainz()`, `SEARCH_PAGE_SIZE = 25`, `ArtistData`, `AlbumData`, `SongData`, `AlbumDetail`, `SearchResults(items, total)` |
| `app/catalog/service.py` | 04 | `get_or_cache_artist(mbid) -> Artist`, `get_or_cache_album(mbid) -> Album`, `get_or_cache_song(mbid) -> Song`, `get_or_cache(kind, mbid)`, `find_cached(kind, mbid)` with no network |

Blueprints: `auth` at `/api/auth`, `catalog`, `ratings`, and `playlists` at `/api`, plus `history` at `/api` from slice 09 so it never shares a file with slice 07. Feature slices only add routes to their own `routes.py`.

### Test fixtures

`api/tests/conftest.py` (slice 02, extended by 04):

| Fixture | Gives |
|---|---|
| `app` | session scoped app on `TEST_DATABASE_URL`, schema rebuilt from migrations |
| `client` | Flask test client |
| `make_user(username="alice", password="password123") -> User` | committed user, email `<username>@example.com` |
| `login(user)` | puts `user.id` in the client session |
| `make_artist(name="Radiohead") -> Artist` | fully cached artist with random MBID |
| `make_song(artist, title="Airbag") -> Song` | song with random MBID |
| `make_album(artist, title="OK Computer", songs=()) -> Album` | fully cached album, songs linked in order |
| `rate(user, entity, stars, review=None) -> Rating` | explicit rating on a song, album, or artist |
| `fake_mb` (autouse, slice 04) | `FakeMusicBrainz` installed as the app's client |

Tables are truncated after every test.

`api/tests/fakes.py` (slice 04) exports MBIDs backed by recorded fixtures:

| Constant | Entity |
|---|---|
| `RADIOHEAD` | `a74b1b7f-71a5-4011-9441-d0b5e4122711` |
| `OK_COMPUTER` | `b1392450-e666-3926-a536-22c65f834433`, tracks Airbag, Paranoid Android, Subterranean Homesick Alien |
| `AIRBAG` | `4a7fea2e-545b-4c63-bc9a-9943cc3a29d7` |
| `PARANOID_ANDROID` | `9f9cf187-d6f9-437f-9d98-d59cdbd52757` |
| `KARMA_POLICE` | `9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3` |

`FakeMusicBrainz.calls` lists every request path made, `routes` maps a path to a fixture payload and can be extended per test, and setting `unavailable = True` makes every call raise `CatalogUnavailable`. Search requests return the same fixture for any query: artists Radiohead and On a Friday, albums OK Computer and OK Computer (8-bit), songs two live Karma Police recordings. The discography route returns Radiohead's albums for any artist.

### JSON shapes

```ts
type Kind = "song" | "album" | "artist"
ArtistSummary  { mbid, name }
AlbumSummary   { mbid, title, release_year: number | null, artist: ArtistSummary }
SongSummary    { mbid, title, disambiguation: string | null, length_ms: number | null, artist: ArtistSummary }
MyRating       { stars: number, is_derived: boolean, song_count: number, review: string | null }
CommunityRating{ stars: number | null, count: number }
RatingSummary  { mine: MyRating | null, community: CommunityRating }
Page<T>        { items: T[], page: number, pages: number, total: number }
User           { id, username, email }
PublicUser     { username }
Review         { id, user: PublicUser, stars, review, updated_at }
HistoryEntry   { id, kind: Kind, item: ArtistSummary | AlbumSummary | SongSummary, stars, review, updated_at }
Playlist       { id, name, description: string | null, is_public, owner: PublicUser, song_count, updated_at }
PlaylistDetail = Playlist & { songs: SongSummary[] }
```

Rateable items on detail pages carry `rating: RatingSummary`.

### API routes

| Route | Slice | Response |
|---|---|---|
| `POST /api/auth/register {email, username, password}` | 05 | 201 `{user: User}` |
| `POST /api/auth/login {email, password}` | 05 | 200 `{user: User}` |
| `POST /api/auth/logout` | 05 | 204 |
| `GET /api/auth/me` | 05 | 200 `{user: User \| null}` |
| `GET /api/search?type=&q=&page=` | 06 | `Page<ArtistSummary \| AlbumSummary \| SongSummary>` |
| `GET /api/artists/<mbid>` | 06 | `{artist: ArtistSummary & {rating}, top_songs: (SongSummary & {rating})[], albums: AlbumSummary[]}` |
| `GET /api/albums/<mbid>` | 06 | `{album: AlbumSummary & {rating}, tracks: (SongSummary & {rating, position})[]}` |
| `GET /api/songs/<mbid>` | 06 | `{song: SongSummary & {rating}}` |
| `PUT /api/ratings {kind, mbid, stars, review?}` | 07 | 200 `{mbid, rating: RatingSummary}`. Omitting `review` keeps the saved one, `""` clears it |
| `DELETE /api/ratings/<kind>/<mbid>` | 07 | 200 `{mbid, rating: RatingSummary}` |
| `GET /api/<kind>s/<mbid>/reviews?page=N` | 07 | `Page<Review>`, page is the only query param |
| `GET /api/users/<username>/history?kind=&page=N` | 09 | `Page<HistoryEntry>`. The web sends `kind` before `page` and drops it for All |
| `GET /api/users/<username>/playlists` | 08 | `{items: Playlist[]}` |
| `POST /api/playlists {name, description?, is_public?}` | 08 | 201 `Playlist` |
| `GET /api/playlists/<id>` | 08 | `PlaylistDetail` |
| `PATCH /api/playlists/<id>` | 08 | `Playlist` |
| `DELETE /api/playlists/<id>` | 08 | 204 |
| `POST /api/playlists/<id>/songs {mbid}` | 08 | 201 `PlaylistDetail` |
| `DELETE /api/playlists/<id>/songs/<mbid>` | 08 | `PlaylistDetail` |
| `PUT /api/playlists/<id>/songs {mbids}` | 08 | `PlaylistDetail` |

### Frontend modules

| Module | Slice | Provides |
|---|---|---|
| `src/api/client.ts` | 03 | `api.get/post/put/patch/delete<T>(path, body?)`, `ApiError {status, code, message}`, `errorMessage(error)` |
| `src/api/types.ts` | 03 | every JSON shape above as a TS type, plus `Rated<T> = T & {rating: RatingSummary}` |
| `src/api/queryClient.ts` | 03 | `queryClient` |
| `src/app/router.ts` | 03 | `routes`, `router`, composes the feature route arrays |
| `src/features/{auth,catalog,history,playlists}/routes.ts` | 03 | `authRoutes`, `catalogRoutes`, `historyRoutes`, `playlistsRoutes`, each `RouteObject[]` using `Component:` and no JSX, filled in by the feature slice |
| `src/features/home/routes.ts` | 002 | `homeRoutes`, the landing page at `/` |
| `src/features/auth/useMe.ts` | 03 | `useMe(): { user: User \| null, isLoading: boolean }` |
| `src/features/auth/redirects.ts` | 05 Task 2 | `loginHref(next)`, `authHref(path, next)`, `safeNext(next)`. Every "Log in to ..." link uses `loginHref` |
| `src/features/auth/useUnauthorizedRedirect.ts` | 05 Task 2 | any mutation failing with 401 clears the session cache through `clearSession` and goes to `/login?next=`, opt out with `meta: { expectsUnauthorized: true }` |
| `src/features/auth/AccountNav.tsx` | 05 | account links in the header |
| `src/ui/index.ts` | 03 | `Button` (accepts `ref`), `buttonClassName`, `SegmentedControl({label, options, value, onChange})`, `Card`, `TextField` (`hideLabel` keeps the label for screen readers only, 002), `TextArea`, `Stars`, `Skeleton`, `Spinner`, `Notice` (`tone="danger"` for form errors), `ErrorNotice`, `PageHeader`, `Pagination({page, pages, onPageChange})`, `cx`, and `formatAverage`, `formatDuration`, `formatDate`, `pluralize` |
| `src/app/AppShell.tsx` | 03 | header bar with the brand linking to `/`, slice 05 mounts `AccountNav` after the `nav` element, footer after `main` (002) |
| `src/ui/global.css` | 03 | element defaults, plus the `visually-hidden` class for screen reader only content (002) |
| `src/test/fetch.ts` | 03 | `mockFetch({"GET /api/path": {status?, body?} or (body) => reply})` stubs `fetch` |
| `src/test/render.tsx` | 03 | `renderWithProviders(ui, {path?})` and `renderAt(path)`, both return the render result plus `queryClient` and `router` |
| `src/features/ratings/RatingControl.tsx` | 07 | `RatingControl({kind, mbid, rating, title?, compact?})`, self-contained, pass `title` on compact rows |
| `src/features/ratings/ReviewList.tsx` | 07 | `ReviewList({kind, mbid})`, no heading or outer margin, the page wraps it in a Reviews section |
| `src/features/playlists/AddToPlaylistButton.tsx` | 08 | `AddToPlaylistButton({mbid})` |
| `src/mocks/browser.ts` | 11 (003 Task 2) | `startMockApi(): Promise<void>`, starts `setupWorker` over a leading 250 ms delay then every feature's handlers |
| `src/mocks/respond.ts` | 11 (003 Task 2) | `MockApiError {status, code}`, `unauthorized(message?)`, `invalid(message)`, `notFound(message)`, `conflict(message)`, `route(resolver)`, `created(body)`, `noContent()`, `requiredText(data, field, maxLength)`, `optionalText(data, field, maxLength)`, `pageArg(url)`, `pagePayload(items, page, total, perPage)`, `paginate(all, page, perPage)`, `isUnhandledApiRequest(request)` |
| `src/mocks/testing.ts` | 11 (003 Tasks 2 and 4) | `useMockServer(...handlers)` registers an `msw/node` server and resets the store before each test, `call<T>(method, path, body?) -> {status, body}` |
| `src/mocks/handlers/<feature>.ts` | 11, then 05 to 09 | `authHandlers`, `catalogHandlers`, `ratingsHandlers`, `playlistsHandlers`, `historyHandlers`, each `HttpHandler[]`, filled by the feature that owns the routes |
| `src/mocks/seed.ts` | 11 (003 Task 3) | `SEED_ARTISTS`, `SEED_ALBUMS`, `SEED_SONGS`, `SEED_USERS`, `SEED_RATINGS`, `SEED_PLAYLISTS`, `DEMO_LOGIN`, and the `MockUser`, `MockRating`, `MockPlaylist` record types |
| `src/mocks/catalog.ts` | 11 (003 Task 3) | `artistSummary(mbid)`, `albumSummary(mbid)`, `songSummary(mbid)`, `SUMMARIES`, `hasEntity(kind, mbid)`, `albumTracks`, `artistAlbums`, `artistTopSongs`, `songsBy`, `songsOn`, `searchCatalog(kind, query)` |
| `src/mocks/store.ts` | 11 (003 Task 4) | `state()`, `save()`, `resetStore()`, `nextId()`, `now()`, `STORAGE_KEY`, `STORE_VERSION`, `currentUser()`, `requireUser()`, `logIn(user)`, `logOut()`, `userPayload(user)`, `publicUser(userId)`, `findUserByName(username)`, `ratingSummary(kind, mbid)`, `rated(kind, mbid, summary)`, and re-exports the `Mock*` record types |

Routes: `/login`, `/register` (05), `/` home page (002), `/search`, `/artists/:mbid`, `/albums/:mbid`, `/songs/:mbid` (06), `/users/:username/history` (09), `/users/:username/playlists`, `/playlists/:id` (08).

Query keys: `["me"]`, `["search", type, q, page]`, `["artist", mbid]`, `["album", mbid]`, `["song", mbid]`, `["reviews", kind, mbid, page]`, `["history", username, kind, page]`, `["playlists", username]`, `["playlist", id]`. A rating change invalidates `["artist"]`, `["album"]`, `["song"]`, `["reviews"]`, and `["history"]`.
