# Slice 06 Catalog Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search MusicBrainz and open artist, album, and song pages that show the viewer's and the community's ratings.

**Architecture:** The catalog Blueprint adds a live search route and three detail routes. Detail routes cache through `get_or_cache_*` and attach ratings with one batched `rating_summaries` call per kind. The web side adds typed TanStack Query hooks, a search page that keeps its state in the URL, and three detail pages built from one shared layout and one shared track row.

**Tech Stack:** Flask, SQLAlchemy, pytest, React Router 7, TanStack Query 5, CSS Modules, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/001-local-prototype-design.md`

**Index:** `docs/superpowers/plans/001-local-prototype.md`. Its Global Constraints and Contracts apply to every task here.

**Branch:** `slice/06-catalog-pages`. Tasks 1 to 3 need slice 04 merged. Task 4 also needs slice 08 Task 3 merged. Task 5 also needs slice 07 Task 3 and slice 08 Task 3 merged.

**Phases:** Tasks 3 to 5 run in A1 against the mock, which needs slice 11 merged, and the catalog handlers come from [003](../003-ui-first.md) Task 6. Tasks 1 and 2 run in B.

---

## File map

```
api/
  app/catalog/routes.py              search, artist, album, and song routes
  tests/test_catalog_routes.py
web/
  src/features/catalog/api.ts        useSearch, useArtist, useAlbum, useSong and response types
  src/features/catalog/api.test.tsx
  src/features/catalog/test-data.ts  shared fixtures for catalog tests
  src/features/catalog/routes.ts     catalogRoutes
  src/features/catalog/rows.module.css
  src/features/catalog/Rows.tsx      SongTitle, RowsSkeleton, TrackRow
  src/features/catalog/SearchPage.tsx, SearchPage.module.css, SearchPage.test.tsx
  src/features/catalog/DetailLayout.tsx, DetailLayout.module.css
  src/features/catalog/ArtistPage.tsx, AlbumPage.tsx, SongPage.tsx
  src/features/catalog/DetailPages.test.tsx
```

---

### Task 1: Search route

**Files:**
- Modify: `api/app/catalog/routes.py`
- Test: `api/tests/test_catalog_routes.py`

**Interfaces:**
- Consumes: `musicbrainz()`, `SEARCH_PAGE_SIZE`, `SUMMARIES`, `KINDS`, `required_text`, `page_arg`, `page_payload`, `ValidationError`, the `fake_mb` fixture
- Produces: `GET /api/search?type=song|album|artist&q=&page=` returning `Page<ArtistSummary | AlbumSummary | SongSummary>`. Nothing is cached.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b slice/06-catalog-pages
```

- [ ] **Step 2: Write the failing tests**

`api/tests/test_catalog_routes.py`:

```python
from math import ceil

import pytest
from sqlalchemy import func, select

from app.extensions import db
from app.models import Album, Artist, Song
from tests.fakes import RADIOHEAD


@pytest.mark.parametrize(
    ("kind", "query", "first"),
    [
        ("song", "karma police", "Karma Police"),
        ("album", "ok computer", "OK Computer"),
        ("artist", "radiohead", "Radiohead"),
    ],
)
def test_search_returns_a_page_of_summaries(client, kind, query, first):
    response = client.get("/api/search", query_string={"type": kind, "q": query})

    assert response.status_code == 200
    body = response.json
    item = body["items"][0]
    assert item.get("title", item.get("name")) == first
    assert body["page"] == 1
    assert body["pages"] == ceil(body["total"] / 25)


def test_song_search_includes_disambiguation_and_artist(client):
    body = client.get("/api/search", query_string={"type": "song", "q": "karma"}).json

    assert body["total"] == 34017
    assert body["items"][1] == {
        "mbid": "6a29ed9f-b78c-4281-902a-8ff78af43f67",
        "title": "Karma Police",
        "disambiguation": "live, 1997-12-19: Hammerstein Ballroom, New York City, NY, USA",
        "length_ms": 253720,
        "artist": {"mbid": RADIOHEAD, "name": "Radiohead"},
    }


def test_search_caches_nothing(client):
    for kind in ("song", "album", "artist"):
        client.get("/api/search", query_string={"type": kind, "q": "radiohead"})

    for model in (Song, Album, Artist):
        assert db.session.scalar(select(func.count()).select_from(model)) == 0


@pytest.mark.parametrize(
    ("query_string", "message"),
    [
        ({"type": "playlist", "q": "x"}, "Type must be song, album, or artist"),
        ({"q": "x"}, "Type must be song, album, or artist"),
        ({"type": "song", "q": "   "}, "Query is required"),
        ({"type": "song", "q": "x" * 201}, "Query must be 200 characters or fewer"),
        ({"type": "song", "q": "x", "page": "0"}, "Page must be 1 or greater"),
    ],
)
def test_search_validates_input(client, fake_mb, query_string, message):
    response = client.get("/api/search", query_string=query_string)

    assert response.status_code == 422
    assert response.json == {"error": {"code": "validation_error", "message": message}}
    assert fake_mb.calls == []


def test_search_reports_a_catalog_outage(client, fake_mb):
    fake_mb.unavailable = True

    response = client.get("/api/search", query_string={"type": "song", "q": "karma"})

    assert response.status_code == 502
    assert response.json["error"]["code"] == "catalog_unavailable"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_catalog_routes.py -v`
Expected: FAIL, every request answers 404 because `/api/search` does not exist yet

- [ ] **Step 4: Write the implementation**

Replace `api/app/catalog/routes.py`:

```python
from flask import Blueprint, request

from app.catalog.serializers import SUMMARIES
from app.errors import ValidationError
from app.http import page_arg, page_payload, required_text
from app.kinds import KINDS
from app.musicbrainz import SEARCH_PAGE_SIZE, musicbrainz

bp = Blueprint("catalog", __name__, url_prefix="/api")

MAX_QUERY_LENGTH = 200


@bp.get("/search")
def search():
    kind = request.args.get("type")
    if kind not in KINDS:
        raise ValidationError("Type must be song, album, or artist")
    query = required_text({"query": request.args.get("q")}, "query", MAX_QUERY_LENGTH)
    page = page_arg()

    client = musicbrainz()
    searches = {
        "song": client.search_songs,
        "album": client.search_albums,
        "artist": client.search_artists,
    }
    results = searches[kind](query, page)
    items = [SUMMARIES[kind](item) for item in results.items]
    return page_payload(items, page, results.total, SEARCH_PAGE_SIZE)
```

`required_text` gets a one key dict so its messages read "Query is required" rather than "Q is required".

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_catalog_routes.py -v`
Expected: 11 passed

- [ ] **Step 6: Lint, format, and commit**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): add live catalog search route"
```

### Task 2: Detail routes with ratings

**Files:**
- Modify: `api/app/catalog/routes.py`
- Test: `api/tests/test_catalog_routes.py`

**Interfaces:**
- Consumes: `get_or_cache_artist`, `get_or_cache_album`, `get_or_cache_song`, `rating_summaries`, `current_user`, `album_summary`, fixtures `make_user`, `login`, `rate`
- Produces:
  - `GET /api/artists/<mbid>` returning `{artist: ArtistSummary & {rating}, top_songs: (SongSummary & {rating})[], albums: AlbumSummary[]}`, albums newest first with undated ones last
  - `GET /api/albums/<mbid>` returning `{album: AlbumSummary & {rating}, tracks: (SongSummary & {rating, position})[]}`
  - `GET /api/songs/<mbid>` returning `{song: SongSummary & {rating}}`
  - A malformed MBID answers 404 before any catalog call

Each response embeds the canonical MBID from the cached entity, which differs from the URL when MusicBrainz merged it.

- [ ] **Step 1: Write the failing tests**

Add these imports to `api/tests/test_catalog_routes.py`:

```python
import uuid

from app.catalog.service import find_cached, get_or_cache_album, get_or_cache_artist, get_or_cache_song
from tests.fakes import AIRBAG, KARMA_POLICE, OK_COMPUTER
```

Merge the `tests.fakes` import with the existing one, then append:

```python
UNRATED = {"mine": None, "community": {"stars": None, "count": 0}}
UNKNOWN = "00000000-0000-4000-8000-000000000003"


def test_artist_detail_lists_top_songs_and_albums(client):
    body = client.get(f"/api/artists/{RADIOHEAD}").json

    assert body["artist"] == {"mbid": RADIOHEAD, "name": "Radiohead", "rating": UNRATED}
    assert [song["title"] for song in body["top_songs"]] == [
        "Karma Police",
        "Paranoid Android",
        "No Surprises",
        "All I Need",
        "Creep",
    ]
    assert all(song["rating"] == UNRATED for song in body["top_songs"])
    assert [album["title"] for album in body["albums"]] == ["In Rainbows", "Hail to the Thief"]


def test_artist_albums_list_undated_last(client):
    artist = get_or_cache_artist(RADIOHEAD)
    db.session.add(Album(mbid=str(uuid.uuid4()), title="Demos", artist=artist))
    db.session.commit()

    albums = client.get(f"/api/artists/{RADIOHEAD}").json["albums"]

    assert [album["title"] for album in albums] == ["In Rainbows", "Hail to the Thief", "Demos"]


def test_album_detail_lists_tracks_in_order(client):
    body = client.get(f"/api/albums/{OK_COMPUTER}").json

    assert body["album"]["title"] == "OK Computer"
    assert body["album"]["release_year"] == 1997
    assert body["album"]["rating"] == UNRATED
    assert [(track["position"], track["title"]) for track in body["tracks"]] == [
        (1, "Airbag"),
        (2, "Paranoid Android"),
        (3, "Subterranean Homesick Alien"),
    ]
    assert body["tracks"][0]["length_ms"] == 284400
    assert body["tracks"][0]["rating"] == UNRATED


def test_song_detail(client):
    song = client.get(f"/api/songs/{KARMA_POLICE}").json["song"]

    assert song["title"] == "Karma Police"
    assert song["artist"] == {"mbid": RADIOHEAD, "name": "Radiohead"}
    assert song["rating"] == UNRATED


def test_song_detail_includes_my_rating(client, make_user, login, rate):
    user = make_user()
    rate(user, get_or_cache_song(KARMA_POLICE), 4, review="Still gets me")
    login(user)

    rating = client.get(f"/api/songs/{KARMA_POLICE}").json["song"]["rating"]

    assert rating == {
        "mine": {"stars": 4.0, "is_derived": False, "song_count": 0, "review": "Still gets me"},
        "community": {"stars": 4.0, "count": 1},
    }


def test_album_shows_a_rating_derived_from_one_track(client, make_user, login, rate):
    user = make_user()
    get_or_cache_album(OK_COMPUTER)
    rate(user, find_cached("song", AIRBAG), 3.5)
    login(user)

    body = client.get(f"/api/albums/{OK_COMPUTER}").json

    assert body["album"]["rating"]["mine"] == {
        "stars": 3.5,
        "is_derived": True,
        "song_count": 1,
        "review": None,
    }
    assert body["tracks"][0]["rating"]["mine"]["stars"] == 3.5
    assert body["tracks"][1]["rating"]["mine"] is None


def test_cached_detail_skips_musicbrainz(client, fake_mb):
    client.get(f"/api/albums/{OK_COMPUTER}")
    fake_mb.calls.clear()

    assert client.get(f"/api/albums/{OK_COMPUTER}").status_code == 200
    assert fake_mb.calls == []


@pytest.mark.parametrize("collection", ["artists", "albums", "songs"])
def test_unknown_mbid_is_not_found(client, collection):
    response = client.get(f"/api/{collection}/{UNKNOWN}")

    assert response.status_code == 404
    assert response.json["error"]["code"] == "not_found"


def test_malformed_mbid_is_not_found_without_calling_out(client, fake_mb):
    response = client.get("/api/albums/not-a-uuid")

    assert response.status_code == 404
    assert response.json["error"]["code"] == "not_found"
    assert fake_mb.calls == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_catalog_routes.py -v`
Expected: the 11 search tests pass, the new detail tests FAIL with 404 responses that have no `artist`, `album`, or `song` key

- [ ] **Step 3: Write the implementation**

In `api/app/catalog/routes.py`, replace the imports with:

```python
from uuid import UUID

from flask import Blueprint, request
from sqlalchemy import select

from app.auth.session import current_user
from app.catalog.serializers import SUMMARIES, album_summary
from app.catalog.service import get_or_cache_album, get_or_cache_artist, get_or_cache_song
from app.errors import ValidationError
from app.extensions import db
from app.http import page_arg, page_payload, required_text
from app.kinds import KINDS, Kind
from app.models import Album
from app.musicbrainz import SEARCH_PAGE_SIZE, musicbrainz
from app.ratings.queries import rating_summaries
```

Append below `search`:

```python
@bp.get("/artists/<uuid:mbid>")
def artist_detail(mbid: UUID):
    artist = get_or_cache_artist(str(mbid))
    albums = db.session.scalars(
        select(Album)
        .where(Album.artist_id == artist.id)
        .order_by(Album.release_year.desc().nulls_last(), Album.title)
    )
    return {
        "artist": _rated("artist", [artist])[0],
        "top_songs": _rated("song", [entry.song for entry in artist.top_songs]),
        "albums": [album_summary(album) for album in albums],
    }


@bp.get("/albums/<uuid:mbid>")
def album_detail(mbid: UUID):
    album = get_or_cache_album(str(mbid))
    songs = _rated("song", [track.song for track in album.tracks])
    return {
        "album": _rated("album", [album])[0],
        "tracks": [
            {**song, "position": track.position}
            for song, track in zip(songs, album.tracks, strict=True)
        ],
    }


@bp.get("/songs/<uuid:mbid>")
def song_detail(mbid: UUID):
    return {"song": _rated("song", [get_or_cache_song(str(mbid))])[0]}


# one ratings query per kind no matter how many entities the page shows
def _rated(kind: Kind, entities: list) -> list[dict]:
    user = current_user()
    ratings = rating_summaries(user.id if user else None, kind, [e.id for e in entities])
    return [{**SUMMARIES[kind](entity), "rating": ratings[entity.id]} for entity in entities]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest -v`
Expected: every test in `api/tests` passes, 22 of them in `test_catalog_routes.py`

- [ ] **Step 5: Lint, format, and commit**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): add artist, album, and song detail routes with ratings"
```

### Task 3: Catalog data hooks

**Files:**
- Create: `web/src/features/catalog/api.ts`
- Create: `web/src/features/catalog/test-data.ts`
- Test: `web/src/features/catalog/api.test.tsx`

**Interfaces:**
- Consumes: `api`, `Kind`, `Page`, `Rated`, summary types, `mockFetch`
- Produces:
  - `SearchItems` mapping each kind to its summary type
  - `useSearch<K extends Kind>(type: K, q: string, page: number)` returning `Page<SearchItems[K]>`, idle while `q` is empty
  - `useArtist(mbid)`, `useAlbum(mbid)`, `useSong(mbid)` with types `ArtistDetail`, `AlbumDetail`, `SongDetail`, and `Track = Rated<SongSummary> & {position}`
  - Test data: `RADIOHEAD`, `OK_COMPUTER`, `KARMA_POLICE`, `unrated`, `radiohead`, `karmaPolice`, `okComputer`, `pageOf(items, pages?)`, `artistDetail`, `albumDetail`, `songDetail`

Query keys follow the index: `["search", type, q, page]`, `["artist", mbid]`, `["album", mbid]`, `["song", mbid]`.

- [ ] **Step 1: Write the test data and failing tests**

`web/src/features/catalog/test-data.ts`:

```ts
import type { AlbumSummary, ArtistSummary, Page, RatingSummary, SongSummary } from "../../api/types";
import type { AlbumDetail, ArtistDetail, SongDetail } from "./api";

export const RADIOHEAD = "a74b1b7f-71a5-4011-9441-d0b5e4122711";
export const OK_COMPUTER = "b1392450-e666-3926-a536-22c65f834433";
export const KARMA_POLICE = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";

export const unrated: RatingSummary = { mine: null, community: { stars: null, count: 0 } };
export const radiohead: ArtistSummary = { mbid: RADIOHEAD, name: "Radiohead" };

function song(title: string, mbid: string, lengthMs: number): SongSummary {
  return { mbid, title, disambiguation: null, length_ms: lengthMs, artist: radiohead };
}

export const karmaPolice = song("Karma Police", KARMA_POLICE, 262426);

export const okComputer: AlbumSummary = {
  mbid: OK_COMPUTER,
  title: "OK Computer",
  release_year: 1997,
  artist: radiohead,
};

export function pageOf<T>(items: T[], pages = 1): Page<T> {
  return { items, page: 1, pages, total: items.length };
}

export const artistDetail: ArtistDetail = {
  artist: { ...radiohead, rating: { mine: null, community: { stars: 4.2, count: 18 } } },
  top_songs: [{ ...karmaPolice, rating: unrated }],
  albums: [
    {
      mbid: "6e335887-60ba-38f0-95af-fae7774336bf",
      title: "In Rainbows",
      release_year: 2007,
      artist: radiohead,
    },
  ],
};

export const albumDetail: AlbumDetail = {
  album: { ...okComputer, rating: unrated },
  tracks: [
    { ...song("Airbag", "4a7fea2e-545b-4c63-bc9a-9943cc3a29d7", 284400), rating: unrated, position: 1 },
    {
      ...song("Paranoid Android", "9f9cf187-d6f9-437f-9d98-d59cdbd52757", 384000),
      rating: unrated,
      position: 2,
    },
  ],
};

export const songDetail: SongDetail = { song: { ...karmaPolice, rating: unrated } };
```

`web/src/features/catalog/api.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/catalog/api.test.tsx`
Expected: FAIL, cannot resolve `./api`

- [ ] **Step 3: Write the implementation**

`web/src/features/catalog/api.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { AlbumSummary, ArtistSummary, Kind, Page, Rated, SongSummary } from "../../api/types";

export interface SearchItems {
  song: SongSummary;
  album: AlbumSummary;
  artist: ArtistSummary;
}

export type Track = Rated<SongSummary> & { position: number };

export interface ArtistDetail {
  artist: Rated<ArtistSummary>;
  top_songs: Rated<SongSummary>[];
  albums: AlbumSummary[];
}

export interface AlbumDetail {
  album: Rated<AlbumSummary>;
  tracks: Track[];
}

export interface SongDetail {
  song: Rated<SongSummary>;
}

export function useSearch<K extends Kind>(type: K, q: string, page: number) {
  return useQuery({
    queryKey: ["search", type, q, page],
    queryFn: () => {
      const params = new URLSearchParams({ type, q, page: String(page) });
      return api.get<Page<SearchItems[K]>>(`/search?${params}`);
    },
    enabled: q !== "",
  });
}

export function useArtist(mbid: string) {
  return useQuery({
    queryKey: ["artist", mbid],
    queryFn: () => api.get<ArtistDetail>(`/artists/${mbid}`),
  });
}

export function useAlbum(mbid: string) {
  return useQuery({
    queryKey: ["album", mbid],
    queryFn: () => api.get<AlbumDetail>(`/albums/${mbid}`),
  });
}

export function useSong(mbid: string) {
  return useQuery({
    queryKey: ["song", mbid],
    queryFn: () => api.get<SongDetail>(`/songs/${mbid}`),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/catalog/api.test.tsx`
Expected: 3 passed

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add web/src/features/catalog
git commit -m "feat(web): add catalog query hooks"
```

### Task 4: Search page

Needs slice 08 Task 3 merged for `AddToPlaylistButton`.

**Files:**
- Create: `web/src/features/catalog/rows.module.css`, `web/src/features/catalog/Rows.tsx`
- Create: `web/src/features/catalog/SearchPage.tsx`, `web/src/features/catalog/SearchPage.module.css`
- Modify: `web/src/features/catalog/routes.ts`
- Test: `web/src/features/catalog/SearchPage.test.tsx`

**Interfaces:**
- Consumes: `useSearch`, `AddToPlaylistButton({mbid})`, `ui` components including `SegmentedControl`, `renderAt`, `mockFetch`
- Produces:
  - `SongTitle({song})` and `RowsSkeleton({label})` in `Rows.tsx`, plus row styles in `rows.module.css`
  - Route `/search?q=&type=&page=`, `/` belongs to the home page from plan 002

The query, type, and page live in the URL so back and forward replay searches, and a search link can be shared.

- [ ] **Step 1: Write the failing tests**

`web/src/features/catalog/SearchPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";
import { karmaPolice, OK_COMPUTER, okComputer, pageOf } from "./test-data";

const ME = { "GET /api/auth/me": { body: { user: null } } };

describe("SearchPage", () => {
  it("invites a search before there is a query", async () => {
    const fetchMock = mockFetch(ME);

    renderAt("/search");

    expect(await screen.findByText("Search millions of songs, albums, and artists")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/search"))).toBe(false);
  });

  it("puts the query in the url and lists songs", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma+police&page=1": {
        body: pageOf([{ ...karmaPolice, disambiguation: "live, 1997" }]),
      },
    });
    const { router } = renderAt("/search");

    await userEvent.type(screen.getByLabelText("Search music"), "karma police");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("link", { name: "Karma Police" })).toHaveAttribute(
      "href",
      `/songs/${karmaPolice.mbid}`,
    );
    expect(screen.getByText("live, 1997")).toBeInTheDocument();
    expect(screen.getByText("4:22")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?type=song&q=karma+police");
  });

  it("shows skeleton rows while results load", () => {
    mockFetch({ ...ME, "GET /api/search?type=song&q=karma&page=1": { body: pageOf([karmaPolice]) } });

    renderAt("/search?q=karma");

    expect(screen.getByLabelText("Loading results")).toHaveAttribute("aria-busy", "true");
  });

  it("switches result type from the segmented control", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=ok+computer&page=1": { body: pageOf([karmaPolice]) },
      "GET /api/search?type=album&q=ok+computer&page=1": { body: pageOf([okComputer]) },
    });
    renderAt("/search?q=ok+computer");

    await userEvent.click(await screen.findByRole("button", { name: "Albums" }));

    expect(await screen.findByRole("link", { name: "OK Computer" })).toHaveAttribute(
      "href",
      `/albums/${OK_COMPUTER}`,
    );
    expect(screen.getByText("1997")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Albums" })).toHaveAttribute("aria-pressed", "true");
  });

  it("explains an empty result", async () => {
    mockFetch({ ...ME, "GET /api/search?type=song&q=zzzz&page=1": { body: pageOf([]) } });

    renderAt("/search?q=zzzz");

    expect(await screen.findByText('No results for "zzzz"')).toBeInTheDocument();
  });

  it("shows a catalog outage with a retry", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma&page=1": {
        status: 502,
        body: { error: { code: "catalog_unavailable", message: "Music catalog is unavailable, try again" } },
      },
    });

    renderAt("/search?q=karma");

    expect(await screen.findByRole("alert")).toHaveTextContent("Music catalog is unavailable, try again");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("pages through results", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma&page=1": { body: pageOf([karmaPolice], 3) },
      "GET /api/search?type=song&q=karma&page=2": {
        body: { ...pageOf([{ ...karmaPolice, mbid: "second", title: "Karma Police (live)" }], 3), page: 2 },
      },
    });
    const { router } = renderAt("/search?q=karma");

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByRole("link", { name: "Karma Police (live)" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?type=song&q=karma&page=2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/catalog/SearchPage.test.tsx`
Expected: FAIL, `/search` renders "Page not found" so every `findBy` query times out

- [ ] **Step 3: Write the shared rows**

`web/src/features/catalog/rows.module.css`:

```css
.list {
  display: flex;
  flex-direction: column;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--color-border);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: var(--space-16);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.main {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  min-width: 0;
}

.titleLine {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  max-width: 100%;
}

.title {
  max-width: 100%;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

.duration,
.index {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-sm);
}
```

`web/src/features/catalog/Rows.tsx`:

```tsx
import { Link } from "react-router";
import type { SongSummary } from "../../api/types";
import { Skeleton } from "../../ui";
import rows from "./rows.module.css";

export function SongTitle({ song }: { song: SongSummary }) {
  return (
    <span className={rows.titleLine}>
      <Link to={`/songs/${song.mbid}`} className={rows.title}>
        {song.title}
      </Link>
      {song.disambiguation && <span className={rows.note}>{song.disambiguation}</span>}
    </span>
  );
}

export function RowsSkeleton({ label }: { label: string }) {
  return (
    <ul className={rows.list} aria-busy="true" aria-label={label}>
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className={rows.row}>
          <div className={rows.main}>
            <Skeleton width="40%" />
            <Skeleton width="25%" height="var(--leading-sm)" />
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Write the search page and routes**

`web/src/features/catalog/SearchPage.tsx`:

```tsx
import type { FormEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import type { AlbumSummary, ArtistSummary, Kind, SongSummary } from "../../api/types";
import {
  Button,
  ErrorNotice,
  formatDuration,
  Notice,
  PageHeader,
  Pagination,
  SegmentedControl,
  TextField,
} from "../../ui";
import { AddToPlaylistButton } from "../playlists/AddToPlaylistButton";
import { type SearchItems, useSearch } from "./api";
import { RowsSkeleton, SongTitle } from "./Rows";
import rows from "./rows.module.css";
import styles from "./SearchPage.module.css";

const TYPES: { value: Kind; label: string }[] = [
  { value: "song", label: "Songs" },
  { value: "album", label: "Albums" },
  { value: "artist", label: "Artists" },
];

function parseType(value: string | null): Kind {
  return TYPES.find((option) => option.value === value)?.value ?? "song";
}

function searchParams(q: string, type: Kind, page = 1): URLSearchParams {
  const params = new URLSearchParams({ type });
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return params;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  const type = parseType(params.get("type"));
  const page = Math.max(1, Number(params.get("page")) || 1);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    setParams(searchParams(value, type));
  };

  return (
    <>
      <PageHeader title="Search" />
      <form role="search" className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          {/* keyed by the url query so back and forward refill the input */}
          <TextField key={q} name="q" label="Search music" defaultValue={q} maxLength={200} />
        </div>
        <Button type="submit" variant="primary">
          Search
        </Button>
      </form>
      <div className={styles.types}>
        <SegmentedControl
          label="Result type"
          options={TYPES}
          value={type}
          onChange={(next) => setParams(searchParams(q, next))}
        />
      </div>
      {q ? (
        <Results type={type} q={q} page={page} onPageChange={(next) => setParams(searchParams(q, type, next))} />
      ) : (
        <Notice title="Search millions of songs, albums, and artists">
          Results come from MusicBrainz, the open music encyclopedia. Open any result to rate it.
        </Notice>
      )}
    </>
  );
}

interface ResultsProps {
  type: Kind;
  q: string;
  page: number;
  onPageChange: (page: number) => void;
}

function Results({ type, ...rest }: ResultsProps) {
  switch (type) {
    case "song":
      return <ResultList type="song" {...rest} render={(song) => <SongResult song={song} />} />;
    case "album":
      return <ResultList type="album" {...rest} render={(album) => <AlbumResult album={album} />} />;
    case "artist":
      return <ResultList type="artist" {...rest} render={(artist) => <ArtistResult artist={artist} />} />;
  }
}

interface ResultListProps<K extends Kind> extends Omit<ResultsProps, "type"> {
  type: K;
  render: (item: SearchItems[K]) => ReactNode;
}

function ResultList<K extends Kind>({ type, q, page, onPageChange, render }: ResultListProps<K>) {
  const search = useSearch(type, q, page);

  if (search.isPending) return <RowsSkeleton label="Loading results" />;
  if (search.isError) return <ErrorNotice error={search.error} onRetry={() => search.refetch()} />;
  if (search.data.items.length === 0) {
    return <Notice title={`No results for "${q}"`}>Check the spelling, or try another result type.</Notice>;
  }
  return (
    <>
      <ul className={rows.list}>
        {search.data.items.map((item) => (
          <li key={item.mbid} className={rows.row}>
            {render(item)}
          </li>
        ))}
      </ul>
      <Pagination page={page} pages={search.data.pages} onPageChange={onPageChange} />
    </>
  );
}

function SongResult({ song }: { song: SongSummary }) {
  return (
    <>
      <div className={rows.main}>
        <SongTitle song={song} />
        <span className={rows.meta}>
          <Link to={`/artists/${song.artist.mbid}`}>{song.artist.name}</Link>
        </span>
      </div>
      <span className={rows.duration}>{song.length_ms !== null && formatDuration(song.length_ms)}</span>
      <AddToPlaylistButton mbid={song.mbid} />
    </>
  );
}

function AlbumResult({ album }: { album: AlbumSummary }) {
  return (
    <div className={rows.main}>
      <Link to={`/albums/${album.mbid}`} className={rows.title}>
        {album.title}
      </Link>
      <span className={rows.meta}>
        <Link to={`/artists/${album.artist.mbid}`}>{album.artist.name}</Link>
        {album.release_year !== null && <span>{album.release_year}</span>}
      </span>
    </div>
  );
}

function ArtistResult({ artist }: { artist: ArtistSummary }) {
  return (
    <div className={rows.main}>
      <Link to={`/artists/${artist.mbid}`} className={rows.title}>
        {artist.name}
      </Link>
    </div>
  );
}
```

`web/src/features/catalog/SearchPage.module.css`:

```css
.form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.field {
  flex: 1;
  min-width: 0;
}

.types {
  margin-bottom: var(--space-6);
}

@media (max-width: 640px) {
  .form {
    flex-direction: column;
    align-items: stretch;
  }
}
```

Replace `web/src/features/catalog/routes.ts`:

```ts
import type { RouteObject } from "react-router";
import { SearchPage } from "./SearchPage";

export const catalogRoutes: RouteObject[] = [
  { path: "/search", Component: SearchPage },
];
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/catalog/SearchPage.test.tsx`
Expected: 7 passed

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add web/src
git commit -m "feat(web): add search page with url state and segmented result types"
```

### Task 5: Artist, album, and song pages

Needs slice 07 Task 3 merged for `RatingControl` and `ReviewList`, and slice 08 Task 3 merged for `AddToPlaylistButton`.

**Files:**
- Modify: `web/src/features/catalog/Rows.tsx`, `web/src/features/catalog/rows.module.css`
- Create: `web/src/features/catalog/DetailLayout.tsx`, `web/src/features/catalog/DetailLayout.module.css`
- Create: `web/src/features/catalog/ArtistPage.tsx`, `AlbumPage.tsx`, `SongPage.tsx`
- Modify: `web/src/features/catalog/routes.ts`
- Test: `web/src/features/catalog/DetailPages.test.tsx`

**Interfaces:**
- Consumes: `useArtist`, `useAlbum`, `useSong`, `RatingControl({kind, mbid, rating, compact?})`, `ReviewList({kind, mbid})`, `AddToPlaylistButton({mbid})`
- Produces:
  - `TrackRow({song, index})` for ranked top songs and album tracklists
  - `DetailLayout({aside, children})`, `Section({title, children})`, `DetailSkeleton()`, `DetailError({error, onRetry})`, `useMbidParam()`
  - Routes `/artists/:mbid`, `/albums/:mbid`, `/songs/:mbid`

`ReviewList` sits inside a `Section` titled "Reviews", so `ReviewList` should not render its own heading. Child components get the MBID from the response, not the URL, so a merged MBID still rates the right entity.

- [ ] **Step 1: Write the failing tests**

`web/src/features/catalog/DetailPages.test.tsx`:

```tsx
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Kind } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";
import {
  albumDetail,
  artistDetail,
  KARMA_POLICE,
  OK_COMPUTER,
  pageOf,
  RADIOHEAD,
  songDetail,
} from "./test-data";

const ME = { "GET /api/auth/me": { body: { user: null } } };

function noReviews(kind: Kind, mbid: string) {
  return { [`GET /api/${kind}s/${mbid}/reviews?page=1`]: { body: pageOf([]) } };
}

describe("catalog detail pages", () => {
  it("shows an artist with popular songs and albums", async () => {
    mockFetch({
      ...ME,
      ...noReviews("artist", RADIOHEAD),
      [`GET /api/artists/${RADIOHEAD}`]: { body: artistDetail },
    });

    renderAt(`/artists/${RADIOHEAD}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Radiohead" })).toBeInTheDocument();
    expect(document.title).toBe("Radiohead | TrackmyTracks");
    const popular = screen.getByRole("region", { name: "Popular songs" });
    expect(within(popular).getByRole("link", { name: "Karma Police" })).toHaveAttribute(
      "href",
      `/songs/${KARMA_POLICE}`,
    );
    expect(within(popular).getByText("4:22")).toBeInTheDocument();
    const albums = screen.getByRole("region", { name: "Albums" });
    expect(within(albums).getByRole("link", { name: "In Rainbows" })).toHaveAttribute(
      "href",
      "/albums/6e335887-60ba-38f0-95af-fae7774336bf",
    );
    expect(screen.getByRole("region", { name: "Reviews" })).toBeInTheDocument();
  });

  it("shows an album with its artist, year, and tracklist", async () => {
    mockFetch({
      ...ME,
      ...noReviews("album", OK_COMPUTER),
      [`GET /api/albums/${OK_COMPUTER}`]: { body: albumDetail },
    });

    renderAt(`/albums/${OK_COMPUTER}`);

    expect(await screen.findByRole("heading", { level: 1, name: "OK Computer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Radiohead" })).toHaveAttribute("href", `/artists/${RADIOHEAD}`);
    expect(screen.getByText("1997")).toBeInTheDocument();
    const tracklist = screen.getByRole("region", { name: "Tracklist" });
    expect(within(tracklist).getByRole("link", { name: "Airbag" })).toBeInTheDocument();
    expect(within(tracklist).getByRole("link", { name: "Paranoid Android" })).toBeInTheDocument();
    expect(within(tracklist).getByText("6:24")).toBeInTheDocument();
  });

  it("shows a song with its artist and length", async () => {
    mockFetch({
      ...ME,
      ...noReviews("song", KARMA_POLICE),
      [`GET /api/songs/${KARMA_POLICE}`]: { body: songDetail },
    });

    renderAt(`/songs/${KARMA_POLICE}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Karma Police" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Radiohead" })).toHaveAttribute("href", `/artists/${RADIOHEAD}`);
    expect(screen.getByText("4:22")).toBeInTheDocument();
  });

  it("shows a skeleton while loading", () => {
    mockFetch({ ...ME, [`GET /api/albums/${OK_COMPUTER}`]: { body: albumDetail } });

    renderAt(`/albums/${OK_COMPUTER}`);

    expect(screen.getByLabelText("Loading")).toHaveAttribute("aria-busy", "true");
  });

  it("explains an entry missing from the catalog", async () => {
    mockFetch({
      ...ME,
      [`GET /api/albums/${OK_COMPUTER}`]: {
        status: 404,
        body: { error: { code: "not_found", message: "Not found in the music catalog" } },
      },
    });

    renderAt(`/albums/${OK_COMPUTER}`);

    expect(await screen.findByText("Not in the music catalog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search music" })).toHaveAttribute("href", "/search");
  });

  it("retries after a catalog outage", async () => {
    let calls = 0;
    mockFetch({
      ...ME,
      ...noReviews("song", KARMA_POLICE),
      [`GET /api/songs/${KARMA_POLICE}`]: () =>
        ++calls === 1
          ? {
              status: 502,
              body: { error: { code: "catalog_unavailable", message: "Music catalog is unavailable, try again" } },
            }
          : { body: songDetail },
    });
    renderAt(`/songs/${KARMA_POLICE}`);

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Karma Police" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/catalog/DetailPages.test.tsx`
Expected: FAIL, the detail paths render "Page not found"

- [ ] **Step 3: Add the track row**

Append to `web/src/features/catalog/rows.module.css`:

```css
.index {
  grid-area: index;
  text-align: right;
}

/* tracks share columns so ratings line up down the list */
.track {
  display: grid;
  grid-template-areas: "index main duration rating add";
  grid-template-columns: var(--space-6) minmax(0, 1fr) auto auto auto;
}

.track .main {
  grid-area: main;
}

.track .duration {
  grid-area: duration;
}

.rating {
  grid-area: rating;
}

.add {
  grid-area: add;
}

@media (max-width: 640px) {
  .track {
    grid-template-areas:
      "index main add"
      ". rating duration";
    grid-template-columns: var(--space-6) minmax(0, 1fr) auto;
    row-gap: var(--space-2);
  }

  .track .duration {
    justify-self: end;
  }
}
```

In `web/src/features/catalog/Rows.tsx`, change the imports to:

```tsx
import { Link } from "react-router";
import type { Rated, SongSummary } from "../../api/types";
import { cx, formatDuration, Skeleton } from "../../ui";
import { AddToPlaylistButton } from "../playlists/AddToPlaylistButton";
import { RatingControl } from "../ratings/RatingControl";
import rows from "./rows.module.css";
```

Then append:

```tsx
export function TrackRow({ song, index }: { song: Rated<SongSummary>; index: number }) {
  return (
    <li className={cx(rows.row, rows.track)}>
      <span className={rows.index}>{index}</span>
      <div className={rows.main}>
        <SongTitle song={song} />
      </div>
      <span className={rows.duration}>{song.length_ms !== null && formatDuration(song.length_ms)}</span>
      <div className={rows.rating}>
        <RatingControl compact kind="song" mbid={song.mbid} rating={song.rating} title={song.title} />
      </div>
      <div className={rows.add}>
        <AddToPlaylistButton mbid={song.mbid} />
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Write the shared detail layout**

`web/src/features/catalog/DetailLayout.tsx`:

```tsx
import { type ReactNode, useId } from "react";
import { Link, useParams } from "react-router";
import { ApiError } from "../../api/client";
import { buttonClassName, ErrorNotice, Notice, Skeleton } from "../../ui";
import styles from "./DetailLayout.module.css";
import { RowsSkeleton } from "./Rows";

export function useMbidParam(): string {
  const { mbid } = useParams();
  if (!mbid) throw new Error("Route is missing its :mbid segment");
  return mbid;
}

export function DetailLayout({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <aside className={styles.aside}>{aside}</aside>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className={styles.skeleton}>
      <Skeleton width="6rem" height="var(--leading-xs)" />
      <Skeleton width="min(24rem, 80%)" height="var(--leading-3xl)" />
      <RowsSkeleton label="Loading tracks" />
    </div>
  );
}

export function DetailError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Notice
        title="Not in the music catalog"
        action={
          <Link to="/search" className={buttonClassName("primary")}>
            Search music
          </Link>
        }
      >
        MusicBrainz may have removed or merged this entry.
      </Notice>
    );
  }
  return <ErrorNotice error={error} onRetry={onRetry} />;
}
```

`web/src/features/catalog/DetailLayout.module.css`:

```css
.layout {
  display: grid;
  grid-template-areas: "content aside";
  grid-template-columns: minmax(0, 1fr) 20rem;
  align-items: start;
  gap: var(--space-12);
}

.aside {
  position: sticky;
  top: var(--space-16);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  grid-area: aside;
}

.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  min-width: 0;
  grid-area: content;
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.albumGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: var(--space-4);
  padding: 0;
  list-style: none;
}

.albumTitle {
  font-weight: 600;
}

.albumYear {
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

@media (max-width: 960px) {
  .layout {
    grid-template-areas:
      "aside"
      "content";
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-8);
  }

  .aside {
    position: static;
  }
}

@media (max-width: 640px) {
  .albumGrid {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

The aside comes first in the DOM, so on narrow screens the rating control sits right under the title.

- [ ] **Step 5: Write the three pages**

`web/src/features/catalog/ArtistPage.tsx`:

```tsx
import { Link } from "react-router";
import { Card, Notice, PageHeader } from "../../ui";
import { RatingControl } from "../ratings/RatingControl";
import { ReviewList } from "../ratings/ReviewList";
import { useArtist } from "./api";
import { DetailError, DetailLayout, DetailSkeleton, Section, useMbidParam } from "./DetailLayout";
import styles from "./DetailLayout.module.css";
import { TrackRow } from "./Rows";
import rows from "./rows.module.css";

export function ArtistPage() {
  const query = useArtist(useMbidParam());

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) return <DetailError error={query.error} onRetry={() => query.refetch()} />;
  const { artist, top_songs: topSongs, albums } = query.data;

  return (
    <>
      <PageHeader eyebrow="Artist" title={artist.name} />
      <DetailLayout aside={<RatingControl kind="artist" mbid={artist.mbid} rating={artist.rating} />}>
        <Section title="Popular songs">
          {topSongs.length === 0 ? (
            <Notice title="No listening data yet">
              ListenBrainz has no popularity numbers for this artist.
            </Notice>
          ) : (
            <ol className={rows.list}>
              {topSongs.map((song, i) => (
                <TrackRow key={song.mbid} song={song} index={i + 1} />
              ))}
            </ol>
          )}
        </Section>
        <Section title="Albums">
          {albums.length === 0 ? (
            <Notice title="No studio albums listed" />
          ) : (
            <ul className={styles.albumGrid}>
              {albums.map((album) => (
                <li key={album.mbid}>
                  <Card>
                    <Link to={`/albums/${album.mbid}`} className={styles.albumTitle}>
                      {album.title}
                    </Link>
                    {album.release_year !== null && <p className={styles.albumYear}>{album.release_year}</p>}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Reviews">
          <ReviewList kind="artist" mbid={artist.mbid} />
        </Section>
      </DetailLayout>
    </>
  );
}
```

`web/src/features/catalog/AlbumPage.tsx`:

```tsx
import { Link } from "react-router";
import { Notice, PageHeader } from "../../ui";
import { RatingControl } from "../ratings/RatingControl";
import { ReviewList } from "../ratings/ReviewList";
import { useAlbum } from "./api";
import { DetailError, DetailLayout, DetailSkeleton, Section, useMbidParam } from "./DetailLayout";
import { TrackRow } from "./Rows";
import rows from "./rows.module.css";

export function AlbumPage() {
  const query = useAlbum(useMbidParam());

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) return <DetailError error={query.error} onRetry={() => query.refetch()} />;
  const { album, tracks } = query.data;

  return (
    <>
      <PageHeader
        eyebrow="Album"
        title={album.title}
        meta={
          <span className={rows.meta}>
            <Link to={`/artists/${album.artist.mbid}`}>{album.artist.name}</Link>
            {album.release_year !== null && <span>{album.release_year}</span>}
          </span>
        }
      />
      <DetailLayout aside={<RatingControl kind="album" mbid={album.mbid} rating={album.rating} />}>
        <Section title="Tracklist">
          {tracks.length === 0 ? (
            <Notice title="No tracklist yet">MusicBrainz has not listed the songs on this album.</Notice>
          ) : (
            <ol className={rows.list}>
              {tracks.map((track) => (
                <TrackRow key={track.mbid} song={track} index={track.position} />
              ))}
            </ol>
          )}
        </Section>
        <Section title="Reviews">
          <ReviewList kind="album" mbid={album.mbid} />
        </Section>
      </DetailLayout>
    </>
  );
}
```

`web/src/features/catalog/SongPage.tsx`:

```tsx
import { Link } from "react-router";
import { formatDuration, PageHeader } from "../../ui";
import { AddToPlaylistButton } from "../playlists/AddToPlaylistButton";
import { RatingControl } from "../ratings/RatingControl";
import { ReviewList } from "../ratings/ReviewList";
import { useSong } from "./api";
import { DetailError, DetailLayout, DetailSkeleton, Section, useMbidParam } from "./DetailLayout";
import rows from "./rows.module.css";

export function SongPage() {
  const query = useSong(useMbidParam());

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) return <DetailError error={query.error} onRetry={() => query.refetch()} />;
  const { song } = query.data;

  return (
    <>
      <PageHeader
        eyebrow="Song"
        title={song.title}
        meta={
          <span className={rows.meta}>
            <Link to={`/artists/${song.artist.mbid}`}>{song.artist.name}</Link>
            {song.length_ms !== null && <span>{formatDuration(song.length_ms)}</span>}
            {song.disambiguation && <span>{song.disambiguation}</span>}
          </span>
        }
      />
      <DetailLayout
        aside={
          <>
            <RatingControl kind="song" mbid={song.mbid} rating={song.rating} />
            <AddToPlaylistButton mbid={song.mbid} />
          </>
        }
      >
        <Section title="Reviews">
          <ReviewList kind="song" mbid={song.mbid} />
        </Section>
      </DetailLayout>
    </>
  );
}
```

Replace `web/src/features/catalog/routes.ts`:

```ts
import type { RouteObject } from "react-router";
import { AlbumPage } from "./AlbumPage";
import { ArtistPage } from "./ArtistPage";
import { SearchPage } from "./SearchPage";
import { SongPage } from "./SongPage";

export const catalogRoutes: RouteObject[] = [
  { path: "/search", Component: SearchPage },
  { path: "/artists/:mbid", Component: ArtistPage },
  { path: "/albums/:mbid", Component: AlbumPage },
  { path: "/songs/:mbid", Component: SongPage },
];
```

- [ ] **Step 6: Run every check**

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, 6 of them in `DetailPages.test.tsx`, lint reports no errors, and the build succeeds.

- [ ] **Step 7: See it in the browser**

With `docker compose up -d --wait`, `flask run` in `api/`, and `npm run dev` in `web/`, open `http://localhost:5173`.

Expected:
1. `/` lands on `/search` with the empty state.
2. Searching "ok computer" with Albums selected lists OK Computer. The first open takes a couple of seconds while the tracklist caches, and the skeleton shows in the meantime.
3. The album page shows Radiohead and 1997 under the title, the rating panel on the right, and a tracklist whose stars line up in one column.
4. The Radiohead link opens the artist page with five popular songs and a grid of album cards.
5. At 375px wide, the rating panel moves under the title, track rows wrap their rating onto a second line, album cards stack in one column, and nothing scrolls sideways.
6. Browser back returns to the search with the query still in the input.

- [ ] **Step 8: Commit and open the pull request**

```bash
npm run lint
git add web/src
git commit -m "feat(web): add artist, album, and song pages"
git push -u origin slice/06-catalog-pages
gh pr create --fill --base main
```
