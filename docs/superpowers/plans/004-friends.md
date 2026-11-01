# 004 Friends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mutual friend requests, a Friends page, friend buttons on reviews, and a friends activity feed on the logged in home page.

**Architecture:** One `friendships` table with one row per pair, a new `friends` Flask blueprint over a small service module, and a `features/friends` web folder. Friendship status on buttons is derived in the browser from `GET /api/friends`, so no existing JSON shape changes.

**Tech Stack:** Flask 3.1, Flask-SQLAlchemy, Flask-Migrate, Postgres 16, pytest. React 19, TypeScript, React Router 7, TanStack Query 5, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/004-friends-design.md`

## Global Constraints

- Every Global Constraint in `docs/superpowers/plans/001-local-prototype.md` applies, like error shape `{"error": {"code", "message"}}`, codes `validation_error` 422, `unauthorized` 401, `not_found` 404, `conflict` 409, and pages of 20
- Unknown username answers 404 `User not found`
- Frontend uses only `src/ui/` components and tokens from `src/ui/tokens.css`
- Code comments follow CLAUDE.md, brief, ASCII, no trailing period on one liners, no semicolons or dashes
- Every created or edited file is added to `claude-files.txt`, sorted
- Branch `feat/friends`, local commits only, never push, no pull request
- Before each commit run `ruff format . && ruff check .` in `api/` or `npm run lint` in `web/`
- On this machine Homebrew node needs the wrapper at `/private/tmp/claude-501/-Users-saeraxmed/2a97ad62-019c-4bf9-aade-ed7a0a01e007/scratchpad/bin` first on `PATH` for any `npm` or `npx` command

## Review Focus

1. Usernames in URLs and search typed in mixed case, like `Sam`, should still find `sam`. Test in Task 1 and Task 2
2. Two users requesting each other at the same moment leaves one row and no 500. Test in Task 1
3. A friend button on a guest's view of a song page renders nothing and fires no request. Test in Task 4
4. Unfriending removes that friend's ratings from the feed on the next load. Test in Task 2
5. A feed card for an album or artist rating links to the album or artist page, not a song page. Test in Task 6

---

### Task 1: Friendships table and request routes

**Files:**
- Modify: `api/app/models.py`, `api/app/__init__.py`
- Create: `api/migrations/versions/0002_friendships.py`, `api/app/friends/__init__.py`, `api/app/friends/service.py`, `api/app/friends/routes.py`
- Test: `api/tests/test_friends.py`

**Interfaces:**
- Produces: `Friendship` model with `id`, `requester_id`, `addressee_id`, `accepted_at: datetime | None`, `created_at`, relationships `requester` and `addressee` (joined)
- Produces in `app/friends/service.py`: `friend_ids(user: User) -> Select` of accepted friend user ids, `friends_payload(user) -> dict`, `send_request(user, target: User) -> str`, `accept_request(user, requester: User) -> None`, `remove_friend(user, other: User) -> None`
- Produces: blueprint `bp` named `friends` at `/api`, registered in `create_app`

- [ ] **Step 1: Write failing tests** in `api/tests/test_friends.py`, with a helper `_request(client, username)` posting `{"username": username}` to `/api/friends/requests`

```python
test_request_then_accept_makes_friends      # alice 201 {"status": "sent"}, bob sees incoming alice, accept 200 {"status": "friends"}, both GET /api/friends list each other with "since"
test_lists_are_sorted                      # friends by username, incoming and outgoing newest created_at first
test_crossed_request_accepts                # bob requested alice, alice requesting bob is 201 {"status": "friends"}, one row in friendships
test_duplicate_request_conflicts            # second request 409, request to existing friend 409
test_request_to_self_is_422
test_request_to_unknown_is_404              # error message "User not found"
test_request_username_is_case_insensitive   # {"username": "Bob"} finds bob
test_only_addressee_can_accept              # alice accepting her own sent request to bob is 404 "Friend request not found"
test_delete_declines_cancels_and_unfriends  # each case DELETE /api/friends/<name> 204 and row gone, then a repeat DELETE is 404
test_race_on_unique_index_is_not_500        # insert the crossed row directly, then call send_request after forcing the IntegrityError path, result "friends"
test_routes_require_login                   # GET /api/friends, POST requests, POST accept, DELETE all 401 logged out
```

- [ ] **Step 2: Run** `pytest tests/test_friends.py -q`. Expected: FAIL, 404 on every route

- [ ] **Step 3: Add `Friendship` to `app/models.py`** with `__table_args__`: `CheckConstraint("requester_id <> addressee_id", name="not_self")`, `Index("friendships_pair", func.least(requester_id, addressee_id), func.greatest(requester_id, addressee_id), unique=True)`, and an index on `addressee_id`. Both FKs `ondelete="CASCADE"`

- [ ] **Step 4: Generate the migration** with `flask db migrate -m "friendships"`, rename to `0002_friendships.py` with `revision = "0002"` and `down_revision = "0001"`, check the expression index came through and add it by hand if autogenerate dropped it. Run `flask db upgrade` then `flask db check`. Expected: "No new upgrade operations detected"

- [ ] **Step 5: Implement the service and routes.** Routes look up the other user with `user_or_404(username.lower())`. `send_request` returns `"friends"` when a pending row from the target exists, raises `ValidationError("You can't add yourself")` for self, `Conflict("Already friends")` or `Conflict("Request already sent")`, and on `IntegrityError` rolls back, rereads, and accepts a pending crossed row or raises `Conflict`. `accept_request` raises `NotFound("Friend request not found")`. `remove_friend` raises `NotFound("Not friends or requested")` when no row. Response shapes per the spec API table

- [ ] **Step 6: Run** `pytest -q`. Expected: all pass

- [ ] **Step 7: Commit** `feat(api): add friend requests` after `ruff format . && ruff check .`

### Task 2: User search and the friends feed

**Files:**
- Create: `api/app/ratings/entries.py`
- Modify: `api/app/history/routes.py`, `api/app/friends/routes.py`
- Test: `api/tests/test_friends_feed.py`

**Interfaces:**
- Consumes: `friend_ids(user)` from Task 1
- Produces: `rating_entry(rating: Rating) -> dict` in `app/ratings/entries.py`, the moved `_entry`, used by history and feed
- Produces: `GET /api/users?q=` and `GET /api/feed?page=N` per the spec

- [ ] **Step 1: Write failing tests**

```python
test_search_is_prefix_and_case_insensitive  # users sam, samira, jordan, q="SA" gives ["sam", "samira"] as [{"username": ...}]
test_search_excludes_caller_and_caps_at_20  # 25 users user_00.., q="user" gives 20, caller absent
test_search_rejects_blank_and_long          # q="  " 422, q="a"*31 422
test_feed_shows_friends_ratings_newest_first # friend song with review and album without review, items carry "user": {"username": "bob"}, "kind", "item", "stars"
test_feed_excludes_pending_strangers_and_self
test_feed_drops_unfriended                  # after DELETE /api/friends/bob his ratings vanish
test_feed_is_empty_page_without_friends     # {"items": [], "page": 1, "pages": 0, "total": 0}
test_search_and_feed_require_login
```

- [ ] **Step 2: Run** `pytest tests/test_friends_feed.py -q`. Expected: FAIL

- [ ] **Step 3: Move `_entry` to `app/ratings/entries.py` as `rating_entry`** and import it in history. Add the two routes to `app/friends/routes.py`. Search uses `User.username.startswith(q)` with `q` trimmed and lowercased, `limit(20)`. Feed selects `Rating` where `user_id.in_(friend_ids(user))`, ordered `updated_at desc, id desc`, through `paginate`, serializing `{**rating_entry(r), "user": public_user(r.user)}`

- [ ] **Step 4: Run** `pytest -q`. Expected: all pass, `test_history.py` unchanged and green

- [ ] **Step 5: Commit** `feat(api): add user search and friends feed`

### Task 3: Demo friendships in the seed

**Files:**
- Modify: `api/app/seed.py`
- Test: `api/tests/test_seed.py`

- [ ] **Step 1: Add a failing test** `test_seed_adds_demo_friendships`: after seeding twice, alex and sam are accepted friends, jordan to alex is pending, and `friendships` has exactly 2 rows

- [ ] **Step 2: Run** it. Expected: FAIL

- [ ] **Step 3: Add `_demo_friendship(requester, addressee, accepted: bool)`** using `insert(Friendship).on_conflict_do_nothing()`, called after the playlist with alex to sam accepted and jordan to alex pending

- [ ] **Step 4: Run** `pytest -q`. Expected: all pass

- [ ] **Step 5: Commit** `feat(api): seed demo friendships`

### Task 4: Web friends api and FriendButton on reviews

**Files:**
- Modify: `web/src/api/types.ts`, `web/src/features/ratings/api.ts`, `web/src/features/ratings/ReviewList.tsx`, `web/src/features/ratings/ReviewList.module.css`
- Create: `web/src/features/friends/api.ts`, `web/src/features/friends/FriendButton.tsx`, `web/src/features/friends/FriendButton.module.css`
- Test: `web/src/features/friends/FriendButton.test.tsx`, `web/src/features/ratings/ReviewList.test.tsx`

**Interfaces:**
- Produces in `types.ts`: `FriendStatus`, `Friend`, `FriendRequest`, `Friends`, `FeedEntry` per the spec
- Produces in `friends/api.ts`: `useFriends()` (query `["friends"]`, `enabled` only with a user from `useMe`), `friendStatus(friends: Friends | undefined, username: string): FriendStatus`, `useSendRequest()`, `useAcceptRequest()`, `useRemoveFriend()` each taking a username and invalidating `["friends"]` and `["feed"]`, `useUserSearch(q: string)` (query `["users", q]`, enabled when `q` is non empty), `useFeed(page: number)` (query `["feed", page]`, `keepPreviousPage`)
- Produces: `FriendButton({username}: {username: string})`
- `RATED_QUERY_KEYS` gains `["feed"]`

- [ ] **Step 1: Write failing tests** in `FriendButton.test.tsx`

```ts
it("offers Add friend and sends the request")   // POST /api/friends/requests with {username: "sam"}, then GET /api/friends refetched
it("shows Request sent for outgoing")            // text "Request sent", no button
it("offers Accept for incoming")                 // button "Accept sam's request" posts to /api/friends/requests/sam/accept
it("shows Friends for a friend")
it("renders nothing for yourself")
it("renders nothing and fetches nothing logged out") // only GET /api/auth/me called
```

and in `ReviewList.test.tsx` one test that a logged in viewer sees an Add friend button beside another reviewer's name

- [ ] **Step 2: Run** `npx vitest run src/features/friends src/features/ratings`. Expected: FAIL

- [ ] **Step 3: Implement** the types, hooks, and `FriendButton`. Buttons use `Button variant="secondary"` at the small size the UI kit offers, muted states use a `span` with `--color-text-muted`. Each button's accessible name includes the username, like "Add sam as a friend"

- [ ] **Step 4: Mount `FriendButton`** in `ReviewList` inside `.meta` after the author link

- [ ] **Step 5: Run** `npm test` and `npm run lint`. Expected: all pass

- [ ] **Step 6: Commit** `feat(web): add friend buttons on reviews`

### Task 5: Friends page and header link

**Files:**
- Create: `web/src/features/friends/routes.ts`, `web/src/features/friends/FriendsPage.tsx`, `web/src/features/friends/FriendsPage.module.css`
- Modify: `web/src/app/router.ts`, `web/src/features/auth/AccountNav.tsx`, `web/src/features/auth/AccountNav.module.css`
- Test: `web/src/features/friends/FriendsPage.test.tsx`, `web/src/features/auth/AccountNav.test.tsx`

**Interfaces:**
- Consumes: Task 4 hooks and `FriendButton`
- Produces: `friendsRoutes` with `/friends`

- [ ] **Step 1: Write failing tests**

```ts
it("redirects guests to log in")                 // router lands on /login?next=%2Ffriends
it("lists requests, sent, and friends")          // headings "Requests", "Sent", "Your friends", names maya, jordyn_b, sam
it("accepts and declines")                       // Accept posts accept route, Decline sends DELETE /api/friends/maya
it("cancels and unfriends")                      // DELETE /api/friends/jordyn_b and /api/friends/sam
it("searches people")                            // typing "jor" and submitting calls GET /api/users?q=jor, shows jordan with "Add jordan as a friend"
it("shows empty lines")                          // "No requests right now", "You haven't added anyone yet"
```

and in `AccountNav.test.tsx`: the Friends link has name "Friends, 1 request" with one incoming, plain "Friends" with none

- [ ] **Step 2: Run** them. Expected: FAIL

- [ ] **Step 3: Implement** the page per the spec Web section, the route in `router.ts`, and the nav link with a count badge styled from tokens (`--color-accent`, `--color-on-accent`, `--radius-full`)

- [ ] **Step 4: Run** `npm test` and `npm run lint`. Expected: all pass

- [ ] **Step 5: Commit** `feat(web): add friends page and header link`

### Task 6: Friends' Activity on the home page

**Files:**
- Create: `web/src/features/friends/FriendsActivity.tsx`
- Modify: `web/src/features/home/HomePage.tsx`, `web/src/features/home/HomePage.module.css` only if a new class is needed
- Test: `web/src/features/home/HomePage.test.tsx`

**Interfaces:**
- Consumes: `useFeed`, `FeedEntry`, `SectionHeading`

- [ ] **Step 1: Write failing tests**

```ts
it("shows friends activity when logged in")     // heading "Friends' Activity", @sam card with Paranoid Android link to /songs/<mbid>, review text, "Rating: 4.5 out of 5"
it("links album and artist cards to their pages") // album card links /albums/b1 and shows an "Album" pill
it("shows a notice with no activity")           // "Nothing from friends yet", link to /friends
it("keeps Fresh Reviews logged out")            // existing heading "Fresh Reviews", no GET /api/feed
```

- [ ] **Step 2: Run** `npx vitest run src/features/home`. Expected: FAIL

- [ ] **Step 3: Implement `FriendsActivity`** reusing the Fresh Reviews card classes from `HomePage.module.css`, with eyebrow "Your friends", heading "Friends' Activity", `formatDate` for dates, and `Pagination` under the grid. `HomePage` renders `FriendsActivity` when `useMe` has a user, otherwise `FreshReviews`, and `FreshReviews` while `isLoading`

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build`. Expected: all pass

- [ ] **Step 5: Commit** `feat(web): show friends activity on the home page`

### Task 8: Community reviews when the feed is empty

Added after Task 6 at the user's request, so it runs after Task 7 and updates the plan index itself.

**Files:**
- Modify: `api/app/friends/routes.py`, `web/src/features/friends/api.ts`, `web/src/features/friends/FriendsActivity.tsx`, `docs/superpowers/plans/001-local-prototype.md`, `claude-files.txt`
- Test: `api/tests/test_friends_feed.py`, `web/src/features/home/HomePage.test.tsx`

**Interfaces:**
- Produces: `GET /api/reviews/recent?page=N` per the spec, serialized exactly like feed entries
- Produces: `useRecentReviews(page: number, enabled: boolean)` with query key `["recent-reviews", page]`, invalidated with `["feed"]` by friend and rating mutations

- [ ] **Step 1: Write failing API tests**

```python
test_recent_reviews_newest_first_from_everyone_but_me  # strangers and friends included, my own excluded, items carry "user"
test_recent_reviews_skip_ratings_without_text           # a stars only rating is absent
test_recent_reviews_require_login
```

- [ ] **Step 2: Write failing web tests**

```ts
it("falls back to community reviews when the feed is empty") // heading "Fresh Reviews", eyebrow "The community", @maya card, link "Add friends to see their activity here" to /friends
it("shows the empty notice when nobody has reviewed")       // "Nothing from friends yet"
it("does not fetch community reviews when the feed has items")
```

- [ ] **Step 3: Implement** the route next to `/feed`, sharing the feed's serializer and ordering. `FriendsActivity` requests recent reviews only once page 1 of the feed comes back empty, and reuses the same card markup for both lists

- [ ] **Step 4: Update the plan index** routes table and query keys

- [ ] **Step 5: Run** `pytest -q`, `ruff check .`, `npm test`, `npm run lint`, `npm run build`. Expected: all green

- [ ] **Step 6: Commit** `feat: show community reviews when the friends feed is empty`

### Task 7: Contracts, docs, and a real run

**Files:**
- Modify: `docs/superpowers/plans/001-local-prototype.md`, `CLAUDE.md`, `claude-files.txt`

- [ ] **Step 1: Update the plan index** Contracts: `Friendship` in models, the `friends` blueprint, the new shapes, the six routes, `/friends`, `features/friends` modules, query keys `["friends"]`, `["users", q]`, `["feed", page]`, and that a rating change also invalidates `["feed"]`

- [ ] **Step 2: Update `CLAUDE.md`** Current state and the blueprint list to mention friends and the feed

- [ ] **Step 3: Run everything** from a clean state: `pytest -q`, `flask db check`, `ruff check .`, `npm test`, `npm run lint`, `npm run build`. Expected: all green

- [ ] **Step 4: Run the app** with `flask db upgrade` and `flask seed`, log in as alex on http://localhost:5173, and check the feed, badge, Friends page actions, and a review's friend button at desktop width and 375px

- [ ] **Step 5: Commit** `docs: record friends contracts`. Do not push
