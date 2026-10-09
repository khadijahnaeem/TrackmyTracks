# 003 UI First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mock API in the browser that answers the 001 contract, so every planned page is built and demoed before the remaining API work.

**Architecture:** MSW intercepts `/api/*` when Vite runs in `mock` mode. Static seed data holds a real catalog, one persisted store holds users, the session, ratings, and playlists, and handlers split by feature like the Flask blueprints. Handler tests run the same handlers under `msw/node`.

**Tech Stack:** MSW 2, Vite 8 modes, React 19, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/003-ui-first-design.md`

**Index:** `docs/superpowers/plans/001-local-prototype.md`. Its Global Constraints, JSON shapes, API routes, and Frontend modules bind every task here.

## Phases

| Phase | Tasks | Branch |
|---|---|---|
| A0 Mock foundation | 1 to 6 | `slice/11-mock-api` |
| A1 UI | 7 with 001 slice 07 Task 3, 8 with 001 slice 08 Tasks 3 and 4, 9 with 001 slice 09 Task 2, plus 001 slice 05 Tasks 2 to 4 and 06 Tasks 3 to 5 | each 001 slice branch |
| B API | 001 API tasks, no task here | each 001 slice branch |
| C Integration | 10, inside 001 slice 10 | `slice/10-integration` |

## Global Constraints

- Mock code lives only under `web/src/mocks/` and is imported only through the `mock` mode guard in `main.tsx`
- Handler responses use the exact JSON shapes from the index, typed with `src/api/types.ts`
- Errors use `{"error": {"code", "message"}}` with the API's codes and messages, quoted in each task
- Ratings are half stars 0.5 to 5 on the wire, stored as `score` 1 to 10
- Text inputs are trimmed and an empty result is stored as null, review max 2,000, playlist name max 100, description max 500, playlist max 500 songs
- Search pages hold 25 results, reviews and history pages hold 20, `pages` is `ceil(total / per_page)`
- Timestamps go out as ISO 8601 strings
- Every mock response in the browser waits 250 ms, handler tests run without the delay
- `erasableSyntaxOnly` is on, so no constructor parameter properties or enums
- Code comments follow CLAUDE.md, brief, ASCII, no trailing period on one liners, no semicolons or dashes
- Before every commit run `npm run lint`, `npm test`, and `npm run build` in `web/`
- Every commit adds new or changed paths to `claude-files.txt`, sorted

## Review Focus

1. A seed change while a browser holds old saved state discards the old state instead of crashing pages. Test in Task 4
2. A saved session whose user no longer exists reads as logged out, not a 500. Test in Task 4
3. A page calling a route no handler serves gets a visible warning naming the route, not a silent hang. Test in Task 2
4. The production build carries no MSW code. Check in Task 2
5. A whitespace only review is stored as null, and a PUT without `review` keeps the saved one. Test in Task 7

---

### Task 1: Re-sequence the 001 docs

**Files:**
- Modify: `docs/superpowers/plans/001-local-prototype.md`
- Modify: `docs/superpowers/plans/001-local-prototype/05-auth.md`, `06-catalog-pages.md`, `07-ratings-reviews.md`, `08-playlists.md`, `09-history.md`, `10-integration.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: the phase order every later slice follows

- [ ] **Step 1: Update the index**

In `001-local-prototype.md`:
- Add a `Phase` column to the Slices table: 01 to 04 `done`, a new row `11 | [Mock API](../003-ui-first.md) Tasks 1 to 6 | A0`, 05 to 09 `A1 web tasks, B API tasks`, 10 `C`
- Replace the dependency diagram with the phase order from the spec Phases table, keeping the existing web task order: 05 web, then 07 Task 3 and 08 Task 3, then 06 Tasks 4 and 5, with 09 Task 2 any time after A0
- Add one paragraph under the Slices table: web tasks run against `npm run dev:mock`, any route or shape a page changes updates this index in the same pull request, and each B task is checked against this index and its handler file before it runs
- Add rows to Frontend modules for `src/mocks/browser.ts`, `src/mocks/store.ts`, `src/mocks/catalog.ts`, `src/mocks/respond.ts`, `src/mocks/testing.ts`, and `src/mocks/handlers/<feature>.ts`, using the Interfaces blocks of Tasks 2 to 4 below

- [ ] **Step 2: Add a phase note to each slice plan**

Below the `**Branch:**` line of 05 to 09, add one line naming which tasks run in A1 and which in B, and for 07, 08, and 09 the 003 task that adds their handlers. In `10-integration.md` add a line that 003 Task 10 runs first.

- [ ] **Step 3: Update CLAUDE.md**

Under Current state, say slices 01 to 04 are merged and the remaining work follows the phases in `docs/superpowers/plans/003-ui-first.md`. Under Commands, add `npm run dev:mock` with the comment `# no Flask needed, answers /api from src/mocks`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/ claude-files.txt
git commit -m "docs: run the remaining slices ui first"
```

### Task 2: MSW wiring and response helpers

**Files:**
- Modify: `web/package.json`, `web/src/main.tsx`, `web/tsconfig.app.json` if `msw` types need it
- Create: `web/public/mockServiceWorker.js` (generated), `web/src/mocks/browser.ts`, `web/src/mocks/respond.ts`, `web/src/mocks/testing.ts`, `web/src/mocks/handlers/{auth,catalog,ratings,playlists,history}.ts`
- Test: `web/src/mocks/respond.test.ts`

**Interfaces:**
- Produces in `respond.ts`:
  - `class MockApiError extends Error` with `status: number`, `code: string`
  - `unauthorized(message = "Log in to continue")`, `invalid(message)`, `notFound(message)`, `conflict(message)`, each returning a `MockApiError`
  - `route(resolver)` wrapping an MSW resolver: a returned value becomes `HttpResponse.json(value)`, a returned `Response` passes through, a thrown `MockApiError` becomes the contract error response
  - `created(body)` for 201 and `noContent()` for 204
  - `requiredText(data, field, maxLength): string`, `optionalText(data, field, maxLength): string | null`, `pageArg(url: URL): number`, `pagePayload<T>(items: T[], page, total, perPage): Page<T>`, `paginate<T>(all: T[], page, perPage): Page<T>`
  - `isUnhandledApiRequest(request: Request): boolean`
- Produces in `handlers/<feature>.ts`: `authHandlers`, `catalogHandlers`, `ratingsHandlers`, `playlistsHandlers`, `historyHandlers`, each `HttpHandler[]`, empty for now
- Produces in `browser.ts`: `startMockApi(): Promise<void>`, starting `setupWorker` over a leading `http.all("/api/*", async () => { await delay(250) })` then every feature's handlers
- Produces in `testing.ts`: `useMockServer(...handlers: HttpHandler[]): void` registering `setupServer` with `listen({ onUnhandledRequest: "error" })`, `resetHandlers`, and `close` in vitest hooks, and `call<T>(method, path, body?): Promise<{ status: number, body: T }>` which fetches `new URL("/api" + path, location.origin)`

- [ ] **Step 1: Install MSW and generate the worker**

```bash
cd web
npm install --save-dev msw@^2
npx msw init public --save
```

Add the script `"dev:mock": "vite --mode mock"` to `package.json`.

- [ ] **Step 2: Write the failing tests**

`web/src/mocks/respond.test.ts`, using `useMockServer` with throwaway handlers built from `route`:

```ts
test("a returned value answers 200 json")            // status 200, body { ok: true }
test("a thrown MockApiError answers the error shape") // invalid("Name is required") gives 422 { error: { code: "validation_error", message: "Name is required" } }
test("optionalText trims and stores empty as null")   // optionalText({ review: "   " }, "review", 2000) is null
test("text over the limit is rejected")               // optionalText({ review: "a".repeat(2001) }, "review", 2000) throws "Review must be 2000 characters or fewer"
test("requiredText names the missing field")         // requiredText({}, "name", 100) throws "Name is required"
test("pageArg rejects a page outside 1 to 10000")      // "Page must be between 1 and 10000"
test("paginate slices and counts pages")              // 45 items, page 3, perPage 20 gives 5 items, pages 3, total 45
test("only unhandled api requests are flagged")       // isUnhandledApiRequest(new Request("http://localhost/api/x")) true, "/src/main.tsx" false
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/mocks/respond.test.ts`
Expected: FAIL, cannot resolve `./respond`

- [ ] **Step 4: Implement `respond.ts`, `testing.ts`, the empty handler files, and `browser.ts`**

Text and page messages match `api/app/http.py` word for word: `"<Field> is required"`, `"<Field> must be text"`, `"<Field> must be <n> characters or fewer"`, `"Page must be between 1 and 10000"`. Error codes are `unauthorized` 401, `validation_error` 422, `not_found` 404, `conflict` 409.

`startMockApi` starts the worker with `onUnhandledRequest(request, print) { if (isUnhandledApiRequest(request)) print.warning() }`, so a missing handler names its route in the console and Vite's own requests stay quiet.

- [ ] **Step 5: Start the worker in mock mode**

In `main.tsx`, before `createRoot`:

```ts
// the mock only loads in dev:mock, so builds never bundle it
if (import.meta.env.MODE === "mock") await (await import("./mocks/browser")).startMockApi();
```

- [ ] **Step 6: Run tests and checks**

Run: `npm test && npm run lint && npm run build`
Expected: all pass, then `grep -rl "msw" dist/assets` prints nothing

- [ ] **Step 7: Commit**

```bash
git add web/ claude-files.txt
git commit -m "feat(web): add msw mock api wiring for dev:mock"
```

### Task 3: Seed catalog

**Files:**
- Create: `web/src/mocks/seed.ts`, `web/src/mocks/catalog.ts`
- Test: `web/src/mocks/catalog.test.ts`

**Interfaces:**
- Produces in `seed.ts`:
  - `SEED_ARTISTS: SeedArtist[]` with `{ mbid, name, topSongs: string[] }`, `SEED_ALBUMS: SeedAlbum[]` with `{ mbid, title, releaseYear, artistMbid, tracks: string[] }`, `SEED_SONGS: SeedSong[]` with `{ mbid, title, disambiguation, lengthMs, artistMbid }`
  - `SEED_USERS`, `SEED_RATINGS`, `SEED_PLAYLISTS` in the store shapes from Task 4, and `DEMO_LOGIN = { email: "demo@trackmytracks.dev", password: "listen-closely" }`
- Produces in `catalog.ts`:
  - `artistSummary(mbid): ArtistSummary`, `albumSummary(mbid): AlbumSummary`, `songSummary(mbid): SongSummary`, `SUMMARIES: Record<Kind, (mbid: string) => ArtistSummary | AlbumSummary | SongSummary>`
  - `hasEntity(kind: Kind, mbid: string): boolean`
  - `albumTracks(albumMbid): string[]`, `artistAlbums(artistMbid): string[]` newest first then by title, `artistTopSongs(artistMbid): string[]`, `songsBy(artistMbid): string[]`, `songsOn(albumMbid): string[]`
  - `searchCatalog(kind: Kind, query: string): string[]`, matching titles or names case insensitively, in seed order

- [ ] **Step 1: Record the catalog**

Run a throwaway script, never committed, against MusicBrainz at one request per second with the `MB_USER_AGENT` from `.env`. Record five albums with full tracklists from their earliest official release: Radiohead OK Computer (`b1392450-e666-3926-a536-22c65f834433`) and In Rainbows (`6e335887-60ba-38f0-95af-fae7774336bf`), Portishead Dummy, Björk Homogenic, Massive Attack Mezzanine. Store real MBIDs, titles, release years, and track lengths. Each artist's `topSongs` holds five of its seeded songs.

- [ ] **Step 2: Write the seed users, ratings, and playlists**

Three users `mira`, `jonah`, `sofia` plus `demo`, passwords at least 8 characters. Ratings spread so every album has at least one review and one derived average: each seed user rates a few songs, two albums explicitly, and one artist, about half with reviews. `demo` rates two OK Computer songs so its pages show a personal rating from the first login. One public playlist of five or more songs per seed user. Dates fall in the month before 2026-10-01 as ISO strings.

- [ ] **Step 3: Write the failing tests**

```ts
test("OK Computer lists its tracks in order")      // albumTracks(OK_COMPUTER).map(title) starts "Airbag", "Paranoid Android", "Subterranean Homesick Alien"
test("summaries match the contract shapes")       // songSummary(AIRBAG) equals { mbid, title: "Airbag", disambiguation: null, length_ms: 284400, artist: { mbid: RADIOHEAD, name: "Radiohead" } }
test("artist albums are newest first")            // artistAlbums(RADIOHEAD) is [IN_RAINBOWS, OK_COMPUTER]
test("search matches case insensitively")        // searchCatalog("song", "PARANOID") contains PARANOID_ANDROID
test("every reference in the seed resolves")      // every track, top song, rating target, and playlist song is a seeded mbid
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/mocks/catalog.test.ts`
Expected: FAIL, cannot resolve `./catalog`

- [ ] **Step 5: Implement `catalog.ts` over maps keyed by MBID**

- [ ] **Step 6: Run tests, lint, build, and commit**

```bash
npm test && npm run lint && npm run build
git add web/ claude-files.txt
git commit -m "feat(web): seed the mock with a recorded catalog"
```

### Task 4: Store, session, and rating summaries

**Files:**
- Create: `web/src/mocks/store.ts`
- Modify: `web/src/mocks/testing.ts`
- Test: `web/src/mocks/store.test.ts`

**Interfaces:**
- Consumes: `catalog.ts`, `SEED_USERS`, `SEED_RATINGS`, `SEED_PLAYLISTS`
- Produces:
  - `interface MockUser { id, email, username, password }`, `interface MockRating { id, userId, kind: Kind, mbid, score, review: string | null, updatedAt }`, `interface MockPlaylist { id, ownerId, name, description: string | null, isPublic, songs: string[], updatedAt }`
  - `state(): MockState` returning `{ version, sessionUserId: number | null, users, ratings, playlists, nextId }`
  - `save(): void`, `resetStore(): void`, `nextId(): number`, `now(): string`
  - `STORAGE_KEY = "trackmytracks-mock"` and `STORE_VERSION = 1`
  - `currentUser(): MockUser | null`, `requireUser(): MockUser` throwing `unauthorized()`, `logIn(user)`, `logOut()`
  - `userPayload(user): User`, `publicUser(userId): PublicUser`, `findUserByName(username): MockUser | null`
  - `ratingSummary(kind: Kind, mbid: string): RatingSummary` for the current user, `rated<T>(kind, mbid, summary: T): Rated<T>`

- [ ] **Step 1: Write the failing tests**

`beforeEach` clears `localStorage` and calls `resetStore()`. Ratings in the tests are written straight into `state().ratings`.

```ts
test("an explicit song rating shows as mine")                  // score 7 gives mine { stars: 3.5, is_derived: false, song_count: 0, review }
test("album stars average my song ratings when not rated")     // scores 7, 8, 7 on OK Computer songs give 3.7, is_derived true, song_count 3
test("an explicit album rating overrides the average")         // album score 9 gives 4.5, is_derived false, song_count 3
test("an artist averages my songs by that artist")             // two Radiohead songs on different albums, scores 6 and 9, give 3.8
test("community averages effective stars across users")        // effective 3.7 and 4.5 give community { stars: 4.1, count: 2 }
test("no ratings give an empty community")                     // { stars: null, count: 0 } and mine null
test("state survives a reload")                                // save, then a fresh read of localStorage restores the rating
test("saved state from another version is discarded")          // STORAGE_KEY holding version 0 loads the seed instead
test("a session for a missing user reads as logged out")       // sessionUserId pointing at no user gives currentUser() null
test("requireUser without a session is unauthorized")         // throws MockApiError 401 "Log in to continue"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/mocks/store.test.ts`
Expected: FAIL, cannot resolve `./store`

- [ ] **Step 3: Implement `store.ts`**

State loads lazily from `localStorage[STORAGE_KEY]` when its `version` equals `STORE_VERSION`, otherwise from a deep copy of the seed. The derived and community rules follow the 001 spec Effective ratings section, and rounding must match Postgres `ROUND`:

```ts
// tenths of a star, exact for half steps where float division of stars is not
const derivedStars = (scores: number[]) => Math.round((sum(scores) * 5) / scores.length) / 10;
const communityStars = (stars: number[]) => Math.round(sum(stars.map((s) => s * 10)) / stars.length) / 10;
```

An explicit album or artist rating's `song_count` is the number of the user's rated songs on that album or by that artist, an explicit song's is 0.

Then extend `useMockServer` in `testing.ts` to clear `localStorage` and call `resetStore()` before each test, so every handler test starts from the seed.

- [ ] **Step 4: Run tests, lint, build, and commit**

```bash
npm test && npm run lint && npm run build
git add web/ claude-files.txt
git commit -m "feat(web): add the mock store with effective ratings"
```

### Task 5: Auth handlers and the dev:mock guide

**Files:**
- Modify: `web/src/mocks/handlers/auth.ts`, `README.md`
- Test: `web/src/mocks/handlers/auth.test.ts`

**Interfaces:**
- Consumes: `route`, errors, `requiredText`, store session functions
- Produces: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` with the index's responses

Validation matches 001 slice 05 Task 1: email trimmed, lowercased, matched by `^[^@\s]+@[^@\s]+\.[^@\s]+$` else `"Enter a valid email address"`, username lowercased and matched by `^[a-z0-9_]{3,30}$` else `"Username must be 3 to 30 lowercase letters, numbers, or underscores"`, password 8 to 128 characters and never trimmed else `"Password must be 8 to 128 characters"`, conflicts `"Email is already registered"` and `"Username is taken"`, bad login `"Email or password is incorrect"` with 401.

- [ ] **Step 1: Write the failing tests**

```ts
test("register logs in and answers 201")          // then GET /auth/me gives the same user
test("register rejects a taken username")         // 409 conflict "Username is taken"
test("register validates the username rule")      // "Al" gives 422 with the username rule message
test("login with the demo account works")         // DEMO_LOGIN gives 200 { user: { username: "demo" } }
test("a wrong password is unauthorized")         // 401 "Email or password is incorrect"
test("logout clears the session")                 // 204, then /auth/me gives { user: null }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/mocks/handlers/auth.test.ts`
Expected: FAIL, routes answer with the unhandled request error

- [ ] **Step 3: Implement the handlers, then run the tests until they pass**

- [ ] **Step 4: Add the README section**

Under the Web section, a `### Without the API` section: run `npm run dev:mock` from `web/`, nothing else needs to run, log in with the demo email and password, clear the site data in the browser to reset the mock.

- [ ] **Step 5: Lint, build, and commit**

```bash
npm test && npm run lint && npm run build
git add web/ README.md claude-files.txt
git commit -m "feat(web): mock the auth routes"
```

### Task 6: Catalog handlers

**Files:**
- Modify: `web/src/mocks/handlers/catalog.ts`
- Test: `web/src/mocks/handlers/catalog.test.ts`

**Interfaces:**
- Consumes: `catalog.ts`, `ratingSummary`, `rated`, `pageArg`, `pagePayload`, `requiredText`
- Produces: `GET /api/search`, `GET /api/artists/:mbid`, `GET /api/albums/:mbid`, `GET /api/songs/:mbid` with the index's responses

Search mirrors 001 slice 06 Task 1: `type` outside song, album, artist gives `"Type must be song, album, or artist"`, `q` goes through `requiredText({ query: q }, "query", 200)`, 25 per page. Details mirror 06 Task 2: artist with its rated top songs and its albums newest first, album with rated tracks carrying `position` from 1, song rated. An MBID outside the seed answers 404 `"Not found in the music catalog"`.

- [ ] **Step 1: Write the failing tests**

```ts
test("search pages artist results")                // type artist, q "radio" gives { items: [Radiohead summary], page: 1, pages: 1, total: 1 }
test("search requires a query")                     // q "  " gives 422 "Query is required"
test("album detail lists rated tracks in order")   // tracks[0] has position 1, title "Airbag", and a rating
test("artist detail shows top songs and albums")   // top_songs length 5, albums [In Rainbows, OK Computer]
test("detail ratings follow the session")           // logged out mine is null, demo login shows demo's rating
test("an unknown mbid is not found")                // 404 "Not found in the music catalog"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/mocks/handlers/catalog.test.ts`
Expected: FAIL, unhandled request errors

- [ ] **Step 3: Implement the handlers, then run the tests until they pass**

- [ ] **Step 4: Check the app by hand**

Run `npm run dev:mock`, log in with the demo account, and confirm `/api/auth/me` and `/api/albums/b1392450-e666-3926-a536-22c65f834433` answer in the network panel after about 250 ms.

- [ ] **Step 5: Lint, build, commit, and open the A0 pull request**

```bash
npm test && npm run lint && npm run build
git add web/ claude-files.txt
git commit -m "feat(web): mock the catalog routes"
```

### Task 7: Ratings and reviews handlers

Runs in A1 on `slice/07-ratings-reviews`, before that slice's Task 3.

**Files:**
- Modify: `web/src/mocks/handlers/ratings.ts`
- Test: `web/src/mocks/handlers/ratings.test.ts`

**Interfaces:**
- Consumes: store, `catalog.ts`, `ratingSummary`, `optionalText`, `paginate`
- Produces: `PUT /api/ratings`, `DELETE /api/ratings/:kind/:mbid`, `GET /api/:collection/:mbid/reviews` with the index's responses

Rules mirror 001 slice 07 Tasks 1 and 2: login required, kind `"Kind must be song, album, or artist"`, mbid `"Mbid must be a MusicBrainz ID"`, stars `"Stars must be 0.5 to 5 in half star steps"`, an MBID outside the seed answers 404 `"<Kind> not found"`, a PUT without `review` keeps the saved review, `""` clears it, DELETE of nothing still answers the summary, reviews list only ratings with a review, newest first, 20 per page, an unknown target gives an empty page.

- [ ] **Step 1: Write the failing tests**

```ts
test("rating a song returns the fresh summary")         // stars 4 gives mine.stars 4 and updated community
test("a whitespace review is stored as null")           // review "   " gives mine.review null
test("omitting review keeps the saved one")             // PUT with review then PUT without keeps it
test("clearing an album override returns the average") // rate two songs and the album, DELETE album gives is_derived true
test("rating requires login")                           // 401 "Log in to continue"
test("half steps only")                                 // stars 3.3 gives 422 with the stars message
test("reviews list newest first with no empty reviews") // the seeded album lists only rows with text
```

- [ ] **Step 2: Run tests to verify they fail, implement, then run until they pass**

Run: `npx vitest run src/mocks/handlers/ratings.test.ts`

- [ ] **Step 3: Lint, build, and commit**

```bash
npm test && npm run lint && npm run build
git add web/ claude-files.txt
git commit -m "feat(web): mock the ratings and reviews routes"
```

### Task 8: Playlist handlers

Runs in A1 on `slice/08-playlists`, before that slice's Task 3.

**Files:**
- Modify: `web/src/mocks/handlers/playlists.ts`
- Test: `web/src/mocks/handlers/playlists.test.ts`

**Interfaces:**
- Consumes: store, `catalog.ts`, `requiredText`, `optionalText`
- Produces: every playlist route in the index

Rules mirror 001 slice 08 Tasks 1 and 2: create needs `name`, PATCH changes only the keys sent, `is_public` must be a boolean else `"Visibility must be true or false"`, a private playlist and any playlist the viewer may not edit answer 404 `"Playlist not found"`, an unknown owner `"User not found"`, a user's list shows private playlists only to their owner, newest first, adding a duplicate gives 409 `"Song is already in this playlist"`, more than 500 songs `"Playlists hold up to 500 songs"`, removing a missing song `"Song is not in this playlist"`, a reorder must list every song once else `"Reorder must list every song in the playlist exactly once"`, every change updates `updated_at`.

- [ ] **Step 1: Write the failing tests**

```ts
test("create, add, and reorder songs")          // POST, POST songs twice, PUT songs reversed gives that order
test("private playlists hide from others")      // another user GET gives 404 "Playlist not found"
test("a duplicate song conflicts")              // 409 "Song is already in this playlist"
test("reorder must list every song once")       // missing one gives 422 with the reorder message
test("an owner sees private playlists")         // GET /users/demo/playlists includes the private one only for demo
test("delete answers 204 and then 404")
```

- [ ] **Step 2: Run tests to verify they fail, implement, then run until they pass**

Run: `npx vitest run src/mocks/handlers/playlists.test.ts`

- [ ] **Step 3: Lint, build, and commit**

```bash
npm test && npm run lint && npm run build
git add web/ claude-files.txt
git commit -m "feat(web): mock the playlist routes"
```

### Task 9: History handler

Runs in A1 on `slice/09-history`, before that slice's Task 2.

**Files:**
- Modify: `web/src/mocks/handlers/history.ts`
- Test: `web/src/mocks/handlers/history.test.ts`

**Interfaces:**
- Consumes: store, `SUMMARIES`, `paginate`, `pageArg`
- Produces: `GET /api/users/:username/history` with the index's response

Rules mirror 001 slice 09 Task 1: explicit ratings only, newest first, optional `kind` filter with `"Kind must be song, album, or artist"`, 20 per page, an unknown username answers 404 `"User not found"`.

- [ ] **Step 1: Write the failing tests**

```ts
test("history lists explicit ratings newest first")  // demo rates a song then an album, the album comes first
test("kind filters the entries")                     // kind=album lists only albums
test("derived album ratings stay out")               // rating songs alone adds no album entry
test("an unknown user is not found")                 // 404 "User not found"
```

- [ ] **Step 2: Run tests to verify they fail, implement, then run until they pass**

Run: `npx vitest run src/mocks/handlers/history.test.ts`

- [ ] **Step 3: Lint, build, and commit**

```bash
npm test && npm run lint && npm run build
git add web/ claude-files.txt
git commit -m "feat(web): mock the history route"
```

### Task 10: Remove the mock

Runs in C on `slice/10-integration`, before its walkthrough.

**Files:**
- Delete: `web/src/mocks/`, `web/public/mockServiceWorker.js`
- Modify: `web/package.json`, `web/package-lock.json`, `web/src/main.tsx`, `README.md`, `CLAUDE.md`, `docs/superpowers/plans/001-local-prototype.md`, `claude-files.txt`

- [ ] **Step 1: Remove the code and dependency**

```bash
cd web
git rm -r src/mocks public/mockServiceWorker.js
npm uninstall msw
```

Remove the `dev:mock` script, the `msw` key in `package.json`, and the mock guard in `main.tsx`.

- [ ] **Step 2: Remove the docs**

Drop the README `Without the API` section, the `dev:mock` line in CLAUDE.md, the mock rows in the index Frontend modules, and the deleted paths from `claude-files.txt`.

- [ ] **Step 3: Verify**

Run: `npm test && npm run lint && npm run build`, then `grep -rn "msw\|mocks/" src package.json`
Expected: all pass, grep prints nothing

- [ ] **Step 4: Commit**

```bash
git add -A web/ README.md CLAUDE.md docs/ claude-files.txt
git commit -m "chore(web): remove the mock api now the real one serves every route"
```
