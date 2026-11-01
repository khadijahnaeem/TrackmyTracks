# 004 Friends Design

Logged in users can add each other as friends, and their home page shows what their friends have been rating and reviewing. This is the "following, activity feed" item that spec 001 left for later, shaped as mutual friendship instead of one way following.

## Intent

The app is about discovering music through other people. Today the only way to see someone's taste is to open their History page by hand. Friends turn the home page into a place that shows what the people you care about just listened to, the way Letterboxd's friends activity does for films.

## Goals

1. You send someone a friend request, and you are friends only once they accept it
2. You can find people by searching their username, and from their reviews on song, album, and artist pages
3. A Friends page lists your friends, requests waiting on you, and requests you sent, with the actions for each
4. The header shows a Friends link with a count of requests waiting on you
5. When logged in, the home page shows your friends' latest ratings and reviews, newest first, in place of the sample Fresh Reviews
6. Logged out visitors see the home page exactly as it is today
7. When the feed is empty, because you have no friends yet or they have rated nothing, the home page shows the newest reviews from everyone else instead, so a new account never lands on an empty page

## Non-goals

- Notifications, email, or real time updates. Counts refresh when the page refetches
- Blocking users, private profiles, or hiding your history from non friends. History pages stay public as they are today
- Friend suggestions, mutual friend counts, or friends of friends
- Profile pages. A person's name links to their existing History page
- Comments, likes, or reactions on feed items
- Wiring Trending Tracks to real data

## Anti-goals

- An "Add friend" button that lies about the state, like showing Add for someone you are already friends with, or on your own review
- A home page that breaks or looks empty and confusing for a logged out visitor
- Any change to the existing JSON shapes or routes that other pages depend on

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Model | Mutual friendship with request and accept | Requested |
| Discovery | Username search on the Friends page, plus a friend button on each review | Requested |
| Feed content | Explicit ratings of songs, albums, and artists, with or without review text | Requested, a rating is still activity |
| Feed layout | Cards in a 3 column grid like today's Fresh Reviews, under eyebrow "YOUR FRIENDS" and heading "Friends' Activity" | Claude's call, the user approved the mockups without picking, cards match the existing page |
| Declines and unfriends | Silent, the row is deleted and the other person is not told | Claude's call, standard and simplest |
| Crossed requests | If B already requested A, A requesting B accepts it | Claude's call, both clearly want it |
| Status on buttons | Derived in the web app from `GET /api/friends`, so `Review` and other shapes stay unchanged | Anti-goal, no contract changes |
| Feed empty state | Falls back to community reviews, the newest ratings with review text from everyone but you, under eyebrow "The community" and heading "Fresh Reviews", with a muted line "Add friends to see their activity here" linking to `/friends`. The section switches to Friends' Activity once the feed has anything. If there are no reviews at all, a Notice "Nothing from friends yet" links to `/friends` | Requested, newest first |
| Logged out home | Keeps the sample Fresh Reviews | Not requested, a later one line change |
| Simultaneous crossed requests | The request that loses the race on the unique index catches the `IntegrityError`, rereads the row, accepts it when the other side's request is pending and answers `"friends"`, otherwise 409 | Claude's call, keeps the no 500 rule |
| Seed reruns | "Changes nothing" means no duplicates, so a declined demo request or unfriended demo pair comes back on the next `flask seed`, like the existing seeded ratings | Claude's call |
| Home while the session loads | Fresh Reviews stays until `useMe` resolves, so guests never see the feed flash | Claude's call, anti-goal |
| Branch | `feat/friends`, kept local, not pushed, no pull request. Work ends at local commits with every check green, overriding the usual PR workflow for this change | Requested |

## Data model

New migration `0002_friendships`, from `flask db migrate`, then reviewed.

```
friendships
  id            serial primary key
  requester_id  int  references users(id) on delete cascade
  addressee_id  int  references users(id) on delete cascade
  accepted_at   timestamp null       null means pending
  created_at    timestamp default now()
  check (requester_id <> addressee_id)
  unique index on (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  index on addressee_id
```

One row per pair, whichever direction it started. The unique index on the ordered pair makes a duplicate or crossed request a conflict at the database, so two simultaneous requests never leave two rows or a 500. Decline, cancel, and unfriend all delete the row.

Model `Friendship` in `app/models.py` with `requester` and `addressee` relationships.

## API

New blueprint `friends` at `/api` in `app/friends/routes.py`, logic in `app/friends/service.py`, registered in `create_app`. Every route requires a session, `require_user()`, and answers 401 otherwise.

New shapes:

```ts
FriendStatus   "none" | "friends" | "sent" | "received"
Friend         { user: PublicUser, since: string }          since is accepted_at
FriendRequest  { user: PublicUser, sent_at: string }        sent_at is created_at
Friends        { friends: Friend[], incoming: FriendRequest[], outgoing: FriendRequest[] }
FeedEntry      HistoryEntry & { user: PublicUser }
```

| Route | Response |
|---|---|
| `GET /api/friends` | 200 `Friends`. `friends` sorted by username, `incoming` and `outgoing` newest first |
| `GET /api/users?q=` | 200 `{items: PublicUser[]}`. Case insensitive prefix match on username, at most 20, sorted by username, never the caller. `q` is trimmed and lowercased, empty or over 30 characters is 422 |
| `POST /api/friends/requests {username}` | 201 `{status: FriendStatus}`, `"sent"`, or `"friends"` when it accepted a crossed request. Unknown user 404 `User not found`, yourself 422, already friends or already sent 409 |
| `POST /api/friends/requests/<username>/accept` | 200 `{status: "friends"}`. No pending request from that user 404 `Friend request not found` |
| `DELETE /api/friends/<username>` | 204. Removes the friendship or request between you in either direction, so it is decline, cancel, and unfriend. Nothing to remove 404 |
| `GET /api/feed?page=N` | 200 `Page<FeedEntry>`, 20 per page, friends' explicit ratings ordered by `updated_at` then `id` descending. No friends gives an empty page |
| `GET /api/reviews/recent?page=N` | 200 `Page<FeedEntry>`, 20 per page, explicit ratings with non NULL review text from every user except you, same order as the feed. Requires a session like the other friends routes |

`FeedEntry` reuses `_entry` from `app/history/routes.py`, moved to a shared spot so both blueprints call it, plus `user: public_user(rating.user)`. Derived album and artist ratings are not in the feed, same as History.

## Web

```
web/src/features/friends/
  routes.ts               friendsRoutes = [{ path: "/friends", Component: FriendsPage }]
  api.ts                  useFriends, useUserSearch, useSendRequest, useAcceptRequest, useRemoveFriend, useFeed, friendStatus
  FriendsPage.tsx         search, requests, sent, friends
  FriendButton.tsx        FriendButton({username}) state aware button
  FriendsActivity.tsx     the home page feed section
  *.module.css
  *.test.tsx
```

- Query keys: `["friends"]`, `["users", q]`, `["feed", page]`. Every friend mutation invalidates `["friends"]` and `["feed"]`. A rating change also invalidates `["feed"]`
- `friendStatus(friends, username)` maps the `Friends` lists to a `FriendStatus`
- `/friends` logged out redirects to `loginHref("/friends")`
- `AccountNav` adds a Friends `NavLink` after Playlists, with a count badge when `incoming.length > 0`, and an accessible name like "Friends, 1 request"
- `FriendButton` renders nothing for your own name or when logged out. Otherwise `none` shows "Add friend", `sent` shows a muted "Request sent", `received` shows "Accept", `friends` shows a muted "Friends"
- `ReviewList` mounts `FriendButton` beside each author name
- Friends page: `PageHeader` "Friends", a `role="search"` form with a `TextField` "Find people" and results with a `FriendButton` each, then Requests with Accept and Decline, Sent with Cancel, and Your friends with a History link and Unfriend. Empty lists show a short muted line. Two columns on desktop, one under 640px
- Home page: when logged in, `FriendsActivity` replaces `FreshReviews`. Each card has the initial avatar, `@username` linking to their History, a relative or short date, `Stars`, a kind pill for albums and artists, the item title linking to its page, the artist, and the review if any. `Pagination` under the grid. Logged out keeps `FreshReviews`
- Only `src/ui/` components and tokens, per Global Constraints

## Seed

`flask seed` makes alex and sam friends, and adds a pending request from jordan to alex, so a fresh demo shows a feed, a request, and a badge. Running it again changes nothing.

## Testing

API, `api/tests/test_friends.py`:

1. Request, accept, and both sides list each other as friends
2. Crossed request becomes friends, duplicate is 409, self is 422, unknown is 404
3. Decline, cancel, and unfriend each delete the row, and a second delete is 404
4. Accepting with no pending request is 404, only the addressee can accept
5. User search is case insensitive prefix, excludes the caller, caps at 20, rejects empty
6. Feed shows only accepted friends' ratings, newest first, includes ratings without reviews, excludes pending and your own
7. Every route is 401 logged out
8. `flask db check` passes after the migration

Web, Vitest with `mockFetch`:

1. `FriendButton` shows the right label for each status and nothing on your own name
2. Friends page lists the three sections and Accept, Decline, Cancel, and Unfriend call the right routes
3. Search shows results with friend buttons
4. Home page logged in shows Friends' Activity, logged out shows Fresh Reviews, empty feed shows the notice
5. Header badge shows the incoming count

`ruff`, `pytest`, `npm run lint`, `npm test`, and `npm run build` pass. At 375px nothing overflows.

## Plan updates in this change

- Plan index: add the friends blueprint, `Friendship` model, the new shapes, routes, query keys, `/friends` route, and the `friends` frontend modules
- README: no new commands, nothing to change
- `CLAUDE.md` Current state: mention friends and the feed

## Left to the builder

- Exact copy for empty states and button labels beyond the ones above
- Relative versus absolute dates on feed cards, using `formatDate` is fine
- Whether the search runs on submit or as you type with a short debounce
