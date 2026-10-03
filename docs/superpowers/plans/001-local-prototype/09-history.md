# Slice 09 History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anyone can open a user's history and see every song, album, and artist that user rated, newest first, filterable by kind.

**Architecture:** A dedicated `history` Blueprint reads explicit rows from `ratings`, so derived album and artist ratings never appear, and serializes each row with the shared catalog summaries. The web page keeps the filter and page in the URL, so back and forward work and links can be shared.

**Tech Stack:** Flask, SQLAlchemy 2.0, pytest, React Router 7, TanStack Query 5, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/001-local-prototype-design.md`

**Index:** `docs/superpowers/plans/001-local-prototype.md`. Its Global Constraints and Contracts apply to every task here.

**Branch:** `slice/09-history`. Requires slices 02 and 03 merged. Does not need slice 07, the tests write ratings through the `rate` fixture.

---

## File map

```
api/
  app/history/__init__.py       empty
  app/history/routes.py         bp, GET /api/users/<username>/history
  app/__init__.py               registers the history blueprint
  tests/test_history.py
web/
  src/features/history/api.ts                 useHistory
  src/features/history/HistoryPage.tsx
  src/features/history/HistoryPage.module.css
  src/features/history/routes.ts              historyRoutes
  src/features/history/HistoryPage.test.tsx
```

---

### Task 1: History endpoint

**Files:**
- Create: `api/app/history/__init__.py`, `api/app/history/routes.py`
- Modify: `api/app/__init__.py`
- Test: `api/tests/test_history.py`

**Interfaces:**
- Consumes: `Rating` with joined `song`, `album`, `artist`, `User`, `KINDS`, `kind_of`, `SUMMARIES`, `page_arg`, `paginate`, `NotFound`, `ValidationError`, fixtures `client`, `make_user`, `make_artist`, `make_song`, `make_album`, `rate`
- Produces: `GET /api/users/<username>/history?kind=&page=` returning `Page<HistoryEntry>`, where an entry is `{id, kind, item, stars, review, updated_at}`. The blueprint is `history` at `/api`.

The endpoint is public, so every test below runs logged out.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b slice/09-history
```

- [ ] **Step 2: Write the failing tests**

`api/tests/test_history.py`:

```python
import pytest


@pytest.fixture
def catalog(make_artist, make_song, make_album):
    artist = make_artist()
    songs = [make_song(artist, "Airbag"), make_song(artist, "Lucky")]
    return artist, make_album(artist, songs=songs), songs


def _history(client, username="alice", **params):
    return client.get(f"/api/users/{username}/history", query_string=params)


def test_lists_every_kind_newest_first(client, make_user, catalog, rate):
    alice = make_user()
    artist, album, songs = catalog
    rate(alice, songs[0], 4, review="Great opener")
    rate(alice, album, 4.5)
    rate(alice, artist, 5)

    response = _history(client)

    assert response.status_code == 200
    body = response.json
    assert [(e["kind"], e["stars"]) for e in body["items"]] == [
        ("artist", 5.0),
        ("album", 4.5),
        ("song", 4.0),
    ]
    song_entry = body["items"][2]
    assert song_entry["item"] == {
        "mbid": songs[0].mbid,
        "title": "Airbag",
        "disambiguation": None,
        "length_ms": None,
        "artist": {"mbid": artist.mbid, "name": "Radiohead"},
    }
    assert song_entry["review"] == "Great opener"
    assert "T" in song_entry["updated_at"]
    assert (body["page"], body["pages"], body["total"]) == (1, 1, 3)


def test_filters_by_kind(client, make_user, catalog, rate):
    alice = make_user()
    artist, album, songs = catalog
    rate(alice, songs[0], 4)
    rate(alice, album, 4.5)

    response = _history(client, kind="album")

    assert [e["item"]["title"] for e in response.json["items"]] == ["OK Computer"]


def test_rejects_unknown_kind(client, make_user):
    make_user()

    response = _history(client, kind="playlist")

    assert response.status_code == 422
    assert response.json["error"]["code"] == "validation_error"


def test_derived_ratings_never_appear(client, make_user, catalog, rate):
    alice = make_user()
    _, _, songs = catalog
    for song in songs:
        rate(alice, song, 4)

    response = _history(client)

    assert response.json["total"] == 2
    assert {e["kind"] for e in response.json["items"]} == {"song"}


def test_pages_hold_twenty_entries(client, make_user, make_artist, make_song, rate):
    alice = make_user()
    artist = make_artist()
    for i in range(21):
        rate(alice, make_song(artist, f"Song {i}"), 3)

    response = _history(client, page=2)

    assert (response.json["page"], response.json["pages"], response.json["total"]) == (2, 2, 21)
    assert [e["item"]["title"] for e in response.json["items"]] == ["Song 0"]


def test_unknown_user_is_not_found(client):
    response = _history(client, username="ghost")

    assert response.status_code == 404
    assert response.json["error"] == {"code": "not_found", "message": "User not found"}


def test_excludes_other_users_ratings(client, make_user, catalog, rate):
    make_user("alice")
    _, _, songs = catalog
    rate(make_user("bob"), songs[0], 2)

    response = _history(client)

    assert response.json == {"items": [], "page": 1, "pages": 0, "total": 0}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_history.py -v`
Expected: FAIL, every test gets a 404 JSON response because no route matches yet, so the first assertion on status or body fails

- [ ] **Step 4: Write the implementation**

`api/app/history/__init__.py` is empty.

`api/app/history/routes.py`:

```python
from flask import Blueprint, request
from sqlalchemy import select

from app.catalog.serializers import SUMMARIES
from app.errors import NotFound, ValidationError
from app.extensions import db
from app.http import page_arg, paginate
from app.kinds import KINDS, kind_of
from app.models import Rating, User

bp = Blueprint("history", __name__, url_prefix="/api")


def _entry(rating: Rating) -> dict:
    target = rating.song or rating.album or rating.artist
    kind = kind_of(target)
    return {
        "id": rating.id,
        "kind": kind,
        "item": SUMMARIES[kind](target),
        "stars": rating.score / 2,
        "review": rating.review,
        "updated_at": rating.updated_at.isoformat(),
    }


@bp.get("/users/<username>/history")
def user_history(username: str):
    user = db.session.scalar(select(User).filter_by(username=username))
    if user is None:
        raise NotFound("User not found")

    # explicit rows only, derived album and artist ratings live in the views
    query = (
        select(Rating)
        .where(Rating.user_id == user.id)
        .order_by(Rating.updated_at.desc(), Rating.id.desc())
    )
    kind = request.args.get("kind")
    if kind is not None:
        if kind not in KINDS:
            raise ValidationError("Kind must be song, album, or artist")
        query = query.where(getattr(Rating, f"{kind}_id").is_not(None))
    return paginate(query, _entry, page_arg())
```

Register the blueprint in `api/app/__init__.py`. Add the import next to the other blueprint imports:

```python
from app.history.routes import bp as history_bp
```

and add it to the registration loop:

```python
    for blueprint in (auth_bp, catalog_bp, ratings_bp, playlists_bp, history_bp):
        app.register_blueprint(blueprint)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest -v`
Expected: every test passes, including the 7 in `tests/test_history.py`

- [ ] **Step 6: Lint, format, and commit**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): add user rating history endpoint"
```

### Task 2: History page

**Files:**
- Create: `web/src/features/history/api.ts`
- Create: `web/src/features/history/HistoryPage.tsx`, `web/src/features/history/HistoryPage.module.css`
- Modify: `web/src/features/history/routes.ts`
- Test: `web/src/features/history/HistoryPage.test.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError`, `HistoryEntry`, `Kind`, `Page`, `useMe`, `PageHeader`, `Stars`, `Pagination`, `Skeleton`, `Notice`, `ErrorNotice`, `buttonClassName`, `formatDate`, `mockFetch`, `renderAt`
- Produces: `useHistory(username: string, kind: Kind | null, page: number)` with query key `["history", username, kind, page]`, `HistoryPage`, and `historyRoutes` holding `/users/:username/history`. Slice 05's `AccountNav` links here.

Request URLs put `kind` before `page`, like `/api/users/alice/history?kind=album&page=1`. The tests key `mockFetch` on that exact string.

- [ ] **Step 1: Write the failing tests**

`web/src/features/history/HistoryPage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { HistoryEntry, Page } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";

const RADIOHEAD = { mbid: "a1", name: "Radiohead" };
const ENTRIES: HistoryEntry[] = [
  {
    id: 2,
    kind: "album",
    item: { mbid: "b1", title: "OK Computer", release_year: 1997, artist: RADIOHEAD },
    stars: 4.5,
    review: "Better as a whole",
    updated_at: "2026-10-02T18:30:00+00:00",
  },
  { id: 1, kind: "artist", item: RADIOHEAD, stars: 5, review: null, updated_at: "2026-10-01T09:00:00+00:00" },
];
const LOGGED_OUT = { "GET /api/auth/me": { body: { user: null } } };
const ALICE = { "GET /api/auth/me": { body: { user: { id: 1, username: "alice", email: "alice@example.com" } } } };

function pageOf(items: HistoryEntry[]): Page<HistoryEntry> {
  return { items, page: 1, pages: 1, total: items.length };
}

describe("HistoryPage", () => {
  it("lists rated items with stars, dates, and reviews", async () => {
    mockFetch({ ...LOGGED_OUT, "GET /api/users/alice/history?page=1": { body: pageOf(ENTRIES) } });
    renderAt("/users/alice/history");

    expect(await screen.findByRole("link", { name: "OK Computer" })).toHaveAttribute("href", "/albums/b1");
    expect(screen.getByRole("heading", { level: 1, name: "alice" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Rating: 4.5 out of 5" })).toBeInTheDocument();
    expect(screen.getByText("Better as a whole")).toBeInTheDocument();
    expect(screen.getByText("Oct 2, 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Radiohead" })).toHaveLength(2);
  });

  it("filters by kind through the url", async () => {
    const fetchMock = mockFetch({
      ...LOGGED_OUT,
      "GET /api/users/alice/history?page=1": { body: pageOf(ENTRIES) },
      "GET /api/users/alice/history?kind=album&page=1": { body: pageOf([ENTRIES[0]]) },
    });
    renderAt("/users/alice/history");

    await userEvent.click(await screen.findByRole("button", { name: "Albums" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/users/alice/history?kind=album&page=1", expect.anything()),
    );
    expect(screen.getByRole("button", { name: "Albums" })).toHaveAttribute("aria-pressed", "true");
  });

  it("invites the owner to rate something when empty", async () => {
    mockFetch({ ...ALICE, "GET /api/users/alice/history?page=1": { body: pageOf([]) } });
    renderAt("/users/alice/history");

    expect(await screen.findByText("Nothing rated yet")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Your history" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search music" })).toHaveAttribute("href", "/search");
  });

  it("explains an unknown user", async () => {
    mockFetch({
      ...LOGGED_OUT,
      "GET /api/users/ghost/history?page=1": {
        status: 404,
        body: { error: { code: "not_found", message: "User not found" } },
      },
    });
    renderAt("/users/ghost/history");

    expect(await screen.findByText("No user named ghost")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/history`
Expected: FAIL, every test renders the "Page not found" page because no route matches yet, so the `findBy` queries time out

- [ ] **Step 3: Write the query hook**

`web/src/features/history/api.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { HistoryEntry, Kind, Page } from "../../api/types";

export function useHistory(username: string, kind: Kind | null, page: number) {
  const params = new URLSearchParams(kind ? { kind, page: String(page) } : { page: String(page) });
  return useQuery({
    queryKey: ["history", username, kind, page],
    queryFn: () =>
      api.get<Page<HistoryEntry>>(`/users/${encodeURIComponent(username)}/history?${params}`),
  });
}
```

- [ ] **Step 4: Write the page**

`web/src/features/history/HistoryPage.tsx`:

```tsx
import { Link, useParams, useSearchParams } from "react-router";
import { ApiError } from "../../api/client";
import type { HistoryEntry, Kind } from "../../api/types";
import {
  buttonClassName,
  ErrorNotice,
  formatDate,
  Notice,
  PageHeader,
  Pagination,
  SegmentedControl,
  Skeleton,
  Stars,
} from "../../ui";
import { useMe } from "../auth/useMe";
import { useHistory } from "./api";
import styles from "./HistoryPage.module.css";

type Filter = Kind | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "song", label: "Songs" },
  { value: "album", label: "Albums" },
  { value: "artist", label: "Artists" },
];

function parseKind(value: string | null): Kind | null {
  const match = FILTERS.find((filter) => filter.value === value)?.value;
  return match && match !== "all" ? match : null;
}

export function HistoryPage() {
  const { username = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = parseKind(searchParams.get("kind"));
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const { user } = useMe();
  const isOwn = user?.username === username;

  const showPage = (next: number) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set("page", String(next));
      return params;
    });

  // a new filter always starts from the first page
  const showKind = (next: Filter) => setSearchParams(next === "all" ? {} : { kind: next });

  return (
    <>
      <PageHeader eyebrow="History" title={isOwn ? "Your history" : username} />
      <div className={styles.filters}>
        <SegmentedControl label="Filter by kind" options={FILTERS} value={kind ?? "all"} onChange={showKind} />
      </div>
      <HistoryResults username={username} isOwn={isOwn} kind={kind} page={page} onPageChange={showPage} />
    </>
  );
}

interface HistoryResultsProps {
  username: string;
  isOwn: boolean;
  kind: Kind | null;
  page: number;
  onPageChange: (page: number) => void;
}

function HistoryResults({ username, isOwn, kind, page, onPageChange }: HistoryResultsProps) {
  const history = useHistory(username, kind, page);

  if (history.isPending) {
    return (
      <ul aria-busy="true" aria-label="Loading history" className={styles.list}>
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className={styles.row}>
            <div className={styles.main}>
              <Skeleton width="4rem" height="var(--leading-xs)" />
              <Skeleton width="14rem" />
            </div>
            <Skeleton width="5rem" height="var(--space-4)" />
          </li>
        ))}
      </ul>
    );
  }

  if (history.error instanceof ApiError && history.error.status === 404) {
    return <Notice title={`No user named ${username}`}>Check the spelling in the address.</Notice>;
  }

  if (history.isError) {
    return <ErrorNotice error={history.error} onRetry={() => history.refetch()} />;
  }

  const { items, pages } = history.data;
  if (items.length === 0) {
    return isOwn ? (
      <Notice
        title="Nothing rated yet"
        action={
          <Link to="/search" className={buttonClassName("primary")}>
            Search music
          </Link>
        }
      >
        Songs, albums, and artists you rate show up here.
      </Notice>
    ) : (
      <Notice title={`${username} has not rated anything yet`} />
    );
  }

  return (
    <>
      <ul className={styles.list}>
        {items.map((entry) => (
          <HistoryRow key={entry.id} entry={entry} />
        ))}
      </ul>
      <Pagination page={page} pages={pages} onPageChange={onPageChange} />
    </>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { item } = entry;
  const title = "name" in item ? item.name : item.title;
  const artist = "artist" in item ? item.artist : null;

  return (
    <li className={styles.row}>
      <div className={styles.main}>
        <p className={styles.kind}>{entry.kind}</p>
        <Link to={`/${entry.kind}s/${item.mbid}`} className={styles.title}>
          {title}
        </Link>
        {artist && (
          <Link to={`/artists/${artist.mbid}`} className={styles.artist}>
            {artist.name}
          </Link>
        )}
        {entry.review && <p className={styles.review}>{entry.review}</p>}
      </div>
      <div className={styles.meta}>
        <Stars value={entry.stars} label="Rating" size="sm" />
        <time dateTime={entry.updated_at} className={styles.date}>
          {formatDate(entry.updated_at)}
        </time>
      </div>
    </li>
  );
}
```

`web/src/features/history/HistoryPage.module.css`:

```css
.filters {
  margin-bottom: var(--space-6);
}

.list {
  display: flex;
  flex-direction: column;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--color-border);
}

.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--color-border);
}

.main {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.kind {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: var(--leading-xs);
  text-transform: uppercase;
}

.title {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.artist {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

.review {
  display: -webkit-box;
  margin-top: var(--space-2);
  overflow: hidden;
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.meta {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}

.date {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  line-height: var(--leading-xs);
}

@media (max-width: 640px) {
  .row {
    flex-direction: column;
    gap: var(--space-3);
  }

  .meta {
    flex-direction: row;
    align-items: center;
    gap: var(--space-3);
  }
}
```

Replace `web/src/features/history/routes.ts`:

```ts
import type { RouteObject } from "react-router";
import { HistoryPage } from "./HistoryPage";

export const historyRoutes: RouteObject[] = [{ path: "/users/:username/history", Component: HistoryPage }];
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/history`
Expected: 4 passed

- [ ] **Step 6: Run every check**

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, lint reports no errors, and the build succeeds.

- [ ] **Step 7: See it in the browser**

With Flask and Vite running, register or seed a user who has rated a song, an album, and an artist, then open `http://localhost:5173/users/<username>/history`.

Expected:
- Skeleton rows appear briefly, then entries newest first, each with an uppercase kind label, a linked title, amber stars, and a date.
- Clicking Albums narrows the list and updates the address to `?kind=album`, and the browser back button restores All.
- A review longer than three lines is clamped.
- At 375px wide the stars and date sit below each title, the filter bar fits on one line, and nothing scrolls sideways.
- `http://localhost:5173/users/nobody/history` shows "No user named nobody".

- [ ] **Step 8: Lint, commit, and open the pull request**

```bash
npm run lint
git add web/src/features/history
git commit -m "feat(web): add rating history page with kind filter"
git push -u origin slice/09-history
gh pr create --fill --base main
```
