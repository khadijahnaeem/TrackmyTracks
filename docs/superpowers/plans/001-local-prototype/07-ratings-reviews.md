# Slice 07 Ratings and Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users rate songs, albums, and artists in half stars, write reviews, clear overrides, and read everyone's reviews.

**Architecture:** One atomic upsert endpoint writes ratings and reviews, keyed by the existing `(user_id, <kind>_id)` unique constraints, and answers with the fresh `RatingSummary` from slice 02's views, so a cleared album override immediately shows the derived average. A read-only reviews feed pages through ratings that carry text. On the web, `RatingControl` updates optimistically and invalidates every query that shows ratings. `ReviewList` pages through the feed. Slice 06's pages mount both.

**Tech Stack:** Flask, SQLAlchemy Postgres `INSERT ... ON CONFLICT`, pytest, React 19, TanStack Query 5, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/001-local-prototype-design.md`

**Index:** `docs/superpowers/plans/001-local-prototype.md`. Its Global Constraints and Contracts apply to every task here.

**Branch:** `slice/07-ratings-reviews`. Requires slice 04 merged and slice 05 Task 1 merged, for `public_user` and the login endpoints used in manual checks.

**Phases:** Task 3 runs in A1 against the mock, and [003](../003-ui-first.md) Task 7 adds the ratings and reviews handlers. Tasks 1 and 2 run in B.

**Merge early:** slice 06's page tasks import `RatingControl` and `ReviewList`, so open the pull request as soon as Task 3 passes.

---

## File map

```
api/
  app/ratings/service.py        input parsing, upsert, clear, reviews feed
  app/ratings/routes.py         PUT /ratings, DELETE /ratings/<kind>/<mbid>, GET /<kind>s/<mbid>/reviews
  tests/test_ratings.py
  tests/test_reviews.py
web/
  src/features/ratings/api.ts                  useSaveRating, useClearRating, useReviews
  src/features/ratings/RatingControl.tsx       full and compact rating control
  src/features/ratings/ReviewComposer.tsx      review form inside RatingControl
  src/features/ratings/RatingControl.module.css  shared by RatingControl and ReviewComposer
  src/features/ratings/ReviewList.tsx
  src/features/ratings/ReviewList.module.css
  src/features/ratings/RatingControl.test.tsx
  src/features/ratings/ReviewList.test.tsx
```

## Behavior rules

| Case | Result |
|---|---|
| `PUT` without a `review` key | Stars change, an existing review is kept |
| `PUT` with `review` blank or whitespace | Review stored as NULL |
| `PUT` on an MBID not cached yet | Cached through `get_or_cache`, then rated |
| `DELETE` on a cached entity with no rating | 200 with the current summary, nothing changes |
| `DELETE` on an entity never cached | 404, no network |
| Reviews feed for an entity never cached | Empty page, no network |

---

### Task 1: Rate and clear

**Files:**
- Create: `api/app/ratings/service.py`
- Modify: `api/app/ratings/routes.py`
- Test: `api/tests/test_ratings.py`

**Interfaces:**
- Consumes: `require_user`, `json_body`, `optional_text`, `get_or_cache`, `find_cached`, `rating_summaries`, `KINDS`, `Kind`, `Rating`, `ValidationError`, `NotFound`
- Produces:
  - `PUT /api/ratings {kind, mbid, stars, review?}` returns 200 `{mbid, rating: RatingSummary}`
  - `DELETE /api/ratings/<kind>/<mbid>` returns 200 `{mbid, rating: RatingSummary}`
  - `parse_kind(value) -> Kind`, `parse_mbid(value) -> str`, `parse_stars(value) -> int` (the score 1 to 10), `REVIEW_MAX_LENGTH = 2000`
  - `save_rating(user, kind, mbid, changes: dict) -> dict`, `clear_rating(user, kind, mbid) -> dict`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b slice/07-ratings-reviews
```

- [ ] **Step 2: Write the failing tests**

`api/tests/test_ratings.py`:

```python
import pytest
from sqlalchemy import func, select

from app.catalog.service import find_cached
from app.extensions import db
from app.models import Rating
from tests.fakes import KARMA_POLICE, OK_COMPUTER

UNKNOWN = "00000000-0000-4000-8000-000000000002"


@pytest.fixture
def alice(make_user, login):
    user = make_user()
    login(user)
    return user


def _put(client, **body):
    return client.put(
        "/api/ratings", json={"kind": "song", "mbid": KARMA_POLICE, "stars": 4, **body}
    )


def test_rating_requires_login(client):
    response = _put(client)

    assert response.status_code == 401
    assert response.json["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(
    "body",
    [
        {"stars": 0},
        {"stars": 5.5},
        {"stars": 3.3},
        {"stars": "4"},
        {"stars": True},
        {"kind": "playlist"},
        {"mbid": "not-an-id"},
        {"review": "x" * 2001},
    ],
)
def test_invalid_rating_is_rejected(client, alice, body):
    response = _put(client, **body)

    assert response.status_code == 422
    assert response.json["error"]["code"] == "validation_error"


def test_rating_caches_the_song_and_returns_its_summary(client, alice):
    response = _put(client, stars=3.5, review="  Still gets me  ")

    assert response.status_code == 200
    assert response.json == {
        "mbid": KARMA_POLICE,
        "rating": {
            "mine": {
                "stars": 3.5,
                "is_derived": False,
                "song_count": 0,
                "review": "Still gets me",
            },
            "community": {"stars": 3.5, "count": 1},
        },
    }


def test_whitespace_review_is_stored_as_null(client, alice):
    _put(client, review="   ")

    assert db.session.scalar(select(Rating.review)) is None


def test_rating_twice_updates_one_row_and_keeps_the_review(client, alice):
    _put(client, stars=2, review="First take")
    response = _put(client, stars=4.5)

    assert db.session.scalar(select(func.count()).select_from(Rating)) == 1
    assert response.json["rating"]["mine"] == {
        "stars": 4.5,
        "is_derived": False,
        "song_count": 0,
        "review": "First take",
    }


def test_empty_review_clears_it(client, alice):
    _put(client, review="First take")
    response = _put(client, review="")

    assert response.json["rating"]["mine"]["review"] is None


def test_unknown_mbid_is_not_found(client, alice):
    assert _put(client, mbid=UNKNOWN).status_code == 404


def test_clearing_an_album_override_restores_the_average(client, alice):
    _put(client, kind="album", mbid=OK_COMPUTER, stars=4.5)
    album = find_cached("album", OK_COMPUTER)
    for track, stars in zip(album.tracks, (3.5, 4, 3.5), strict=True):
        _put(client, kind="song", mbid=track.song.mbid, stars=stars)

    response = client.delete(f"/api/ratings/album/{OK_COMPUTER}")

    assert response.status_code == 200
    assert response.json["rating"]["mine"] == {
        "stars": 3.7,
        "is_derived": True,
        "song_count": 3,
        "review": None,
    }


def test_clearing_an_unrated_cached_entity_changes_nothing(client, alice, make_artist):
    artist = make_artist()

    response = client.delete(f"/api/ratings/artist/{artist.mbid}")

    assert response.status_code == 200
    assert response.json == {
        "mbid": artist.mbid,
        "rating": {"mine": None, "community": {"stars": None, "count": 0}},
    }


def test_clearing_an_uncached_entity_is_not_found(client, alice, fake_mb):
    response = client.delete(f"/api/ratings/song/{KARMA_POLICE}")

    assert response.status_code == 404
    assert fake_mb.calls == []
```

The album test caches OK Computer through the rating itself, which puts its three tracks into the database. Its tracks can then be rated without any further lookups.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_ratings.py -v`
Expected: FAIL, every test gets a 404 or 405 because no rating routes exist

- [ ] **Step 4: Write the service**

`api/app/ratings/service.py`:

```python
import uuid

from sqlalchemy import delete, func
from sqlalchemy.dialects.postgresql import insert

from app.catalog.service import find_cached, get_or_cache
from app.errors import NotFound, ValidationError
from app.extensions import db
from app.kinds import KINDS, Kind
from app.models import Album, Artist, Rating, Song, User
from app.ratings.queries import rating_summaries

REVIEW_MAX_LENGTH = 2000


def parse_kind(value) -> Kind:
    if value not in KINDS:
        raise ValidationError("Kind must be song, album, or artist")
    return value


def parse_mbid(value) -> str:
    try:
        return str(uuid.UUID(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise ValidationError("Mbid must be a MusicBrainz ID") from error


def parse_stars(value) -> int:
    valid = (
        isinstance(value, int | float)
        and not isinstance(value, bool)
        and 0.5 <= value <= 5
        and float(value * 2).is_integer()
    )
    if not valid:
        raise ValidationError("Stars must be 0.5 to 5 in half star steps")
    return int(value * 2)


def save_rating(user: User, kind: Kind, mbid: str, changes: dict) -> dict:
    entity = get_or_cache(kind, mbid)
    target = f"{kind}_id"
    statement = insert(Rating).values(user_id=user.id, **{target: entity.id}, **changes)
    db.session.execute(
        statement.on_conflict_do_update(
            index_elements=["user_id", target], set_={**changes, "updated_at": func.now()}
        )
    )
    db.session.commit()
    return _rating_payload(user, kind, entity)


def clear_rating(user: User, kind: Kind, mbid: str) -> dict:
    entity = find_cached(kind, mbid)
    if entity is None:
        raise NotFound(f"{kind.capitalize()} not found")
    target = getattr(Rating, f"{kind}_id")
    db.session.execute(delete(Rating).where(Rating.user_id == user.id, target == entity.id))
    db.session.commit()
    return _rating_payload(user, kind, entity)


def _rating_payload(user: User, kind: Kind, entity: Song | Album | Artist) -> dict:
    return {"mbid": entity.mbid, "rating": rating_summaries(user.id, kind, [entity.id])[entity.id]}
```

`ON CONFLICT` makes a double click or two tabs land on one row in one statement, with no read-then-write gap.

- [ ] **Step 5: Write the routes**

Replace `api/app/ratings/routes.py`:

```python
import uuid

from flask import Blueprint

from app.auth.session import require_user
from app.http import json_body, optional_text
from app.ratings.service import (
    REVIEW_MAX_LENGTH,
    clear_rating,
    parse_kind,
    parse_mbid,
    parse_stars,
    save_rating,
)

bp = Blueprint("ratings", __name__, url_prefix="/api")


@bp.put("/ratings")
def put_rating():
    user = require_user()
    data = json_body()
    kind = parse_kind(data.get("kind"))
    mbid = parse_mbid(data.get("mbid"))
    changes = {"score": parse_stars(data.get("stars"))}
    # a missing review key keeps the review already saved
    if "review" in data:
        changes["review"] = optional_text(data, "review", REVIEW_MAX_LENGTH)
    return save_rating(user, kind, mbid, changes)


@bp.delete("/ratings/<kind>/<uuid:mbid>")
def delete_rating(kind: str, mbid: uuid.UUID):
    user = require_user()
    return clear_rating(user, parse_kind(kind), str(mbid))
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest tests/test_ratings.py -v`
Expected: 17 passed

- [ ] **Step 7: Lint, format, and commit**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): add rating upsert and clear endpoints"
```

### Task 2: Reviews feed

**Files:**
- Modify: `api/app/ratings/service.py`, `api/app/ratings/routes.py`
- Test: `api/tests/test_reviews.py`

**Interfaces:**
- Consumes: `find_cached`, `paginate`, `page_payload`, `PER_PAGE`, `page_arg`, `public_user`
- Produces: `GET /api/{songs,albums,artists}/<mbid>/reviews?page=` returning `Page<Review>` with 20 per page, newest first. `reviews_page(kind, mbid, page) -> dict`, `review_payload(rating) -> dict`

- [ ] **Step 1: Write the failing tests**

`api/tests/test_reviews.py`:

```python
from datetime import UTC, datetime

import pytest

from app.extensions import db
from tests.fakes import KARMA_POLICE, OK_COMPUTER


@pytest.fixture
def song(make_artist, make_song):
    return make_song(make_artist(), "Karma Police")


def test_reviews_are_newest_first_and_skip_rating_only_rows(client, song, make_user, rate):
    older = rate(make_user("alice"), song, 3, review="Grower")
    older.updated_at = datetime(2026, 1, 1, tzinfo=UTC)
    db.session.commit()
    newer = rate(make_user("bob"), song, 4.5, review="Instant classic")
    rate(make_user("cal"), song, 2)

    response = client.get(f"/api/songs/{song.mbid}/reviews")

    assert response.status_code == 200
    body = response.json
    assert [(r["user"], r["stars"], r["review"]) for r in body["items"]] == [
        ({"username": "bob"}, 4.5, "Instant classic"),
        ({"username": "alice"}, 3.0, "Grower"),
    ]
    assert body["items"][0]["id"] == newer.id
    assert body["items"][0]["updated_at"] == newer.updated_at.isoformat()
    assert (body["page"], body["pages"], body["total"]) == (1, 1, 2)


def test_whitespace_review_never_reaches_the_feed(client, make_user, login):
    login(make_user())
    client.put(
        "/api/ratings",
        json={"kind": "song", "mbid": KARMA_POLICE, "stars": 4, "review": "   "},
    )

    assert client.get(f"/api/songs/{KARMA_POLICE}/reviews").json["items"] == []


def test_reviews_page_twenty_at_a_time(client, song, make_user, rate):
    for i in range(21):
        rate(make_user(f"user{i:02d}"), song, 4, review=f"Review {i}")

    response = client.get(f"/api/songs/{song.mbid}/reviews?page=2")

    assert len(response.json["items"]) == 1
    assert (response.json["pages"], response.json["total"]) == (2, 21)


def test_uncached_entity_has_no_reviews_and_no_lookup(client, fake_mb):
    response = client.get(f"/api/albums/{OK_COMPUTER}/reviews")

    assert response.json == {"items": [], "page": 1, "pages": 0, "total": 0}
    assert fake_mb.calls == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_reviews.py -v`
Expected: FAIL, the feed routes answer 404

- [ ] **Step 3: Write the implementation**

In `api/app/ratings/service.py`, extend the imports:

```python
from sqlalchemy import delete, func, select

from app.auth.serializers import public_user
from app.http import PER_PAGE, page_payload, paginate
```

Then append:

```python
def reviews_page(kind: Kind, mbid: str, page: int) -> dict:
    entity = find_cached(kind, mbid)
    if entity is None:
        return page_payload([], page, 0, PER_PAGE)
    query = (
        select(Rating)
        .where(getattr(Rating, f"{kind}_id") == entity.id, Rating.review.is_not(None))
        .order_by(Rating.updated_at.desc(), Rating.id.desc())
    )
    return paginate(query, review_payload, page)


def review_payload(rating: Rating) -> dict:
    return {
        "id": rating.id,
        "user": public_user(rating.user),
        "stars": rating.score / 2,
        "review": rating.review,
        "updated_at": rating.updated_at.isoformat(),
    }
```

In `api/app/ratings/routes.py`, add `page_arg` to the `app.http` import, add `reviews_page` to the `app.ratings.service` import, add `from app.kinds import Kind`, then append:

```python
COLLECTIONS: dict[str, Kind] = {"songs": "song", "albums": "album", "artists": "artist"}


@bp.get("/<any(songs, albums, artists):collection>/<uuid:mbid>/reviews")
def list_reviews(collection: str, mbid: uuid.UUID):
    return reviews_page(COLLECTIONS[collection], str(mbid), page_arg())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest -v`
Expected: every test passes, 21 of them in `test_ratings.py` and `test_reviews.py`

- [ ] **Step 5: Lint, format, and commit**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): add paged reviews feed"
```

### Task 3: Rating control and review list

**Files:**
- Create: `web/src/features/ratings/api.ts`
- Create: `web/src/features/ratings/RatingControl.tsx`, `web/src/features/ratings/ReviewComposer.tsx`, `web/src/features/ratings/RatingControl.module.css`
- Create: `web/src/features/ratings/ReviewList.tsx`, `web/src/features/ratings/ReviewList.module.css`
- Test: `web/src/features/ratings/RatingControl.test.tsx`, `web/src/features/ratings/ReviewList.test.tsx`

**Interfaces:**
- Consumes: `api`, `errorMessage`, types `Kind`, `RatingSummary`, `CommunityRating`, `Review`, `Page`, `useMe`, ui `Stars`, `Button`, `buttonClassName`, `Card`, `TextArea`, `Pagination`, `Skeleton`, `Notice`, `ErrorNotice`, `formatAverage`, `formatDate`, `pluralize`, test helpers `mockFetch`, `renderWithProviders`
- Produces:
  - `useSaveRating()` mutation over `{kind, mbid, stars, review?}`, `useClearRating()` mutation over `{kind, mbid}`, both invalidating `["artist"]`, `["album"]`, `["song"]`, `["reviews"]`, `["history"]` on success
  - `useReviews(kind, mbid, page)` on query key `["reviews", kind, mbid, page]`
  - `RatingControl({kind, mbid, rating, title?, compact?})`. `title` names the item in the compact slider label, like "Your rating for Airbag", so tracklist rows stay distinguishable to screen readers
  - `ReviewList({kind, mbid})`, a self-contained "Reviews" section that resets to page 1 when `kind` or `mbid` changes

Optimistic stars live in local state seeded from `rating.mine`. They roll back on error, and when slice 06's page refetches after invalidation, the new `rating` prop replaces them.

- [ ] **Step 1: Write the failing tests**

`web/src/features/ratings/RatingControl.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RatingSummary } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { RatingControl } from "./RatingControl";

const SONG = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
const ALBUM = "b1392450-e666-3926-a536-22c65f834433";
const ME = {
  "GET /api/auth/me": { body: { user: { id: 1, username: "alice", email: "alice@example.com" } } },
};
const UNRATED: RatingSummary = { mine: null, community: { stars: null, count: 0 } };
const RATED: RatingSummary = {
  mine: { stars: 3, is_derived: false, song_count: 0, review: null },
  community: { stars: 3.7, count: 12 },
};

async function pressEnd(name = "Your rating") {
  const slider = await screen.findByRole("slider", { name });
  slider.focus();
  await userEvent.keyboard("{End}");
  return slider;
}

describe("RatingControl", () => {
  it("saves a rating optimistically", async () => {
    const fetchMock = mockFetch({ ...ME, "PUT /api/ratings": { body: { mbid: SONG, rating: RATED } } });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={UNRATED} />);

    const slider = await pressEnd();

    expect(slider).toHaveAttribute("aria-valuenow", "5");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/ratings");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ kind: "song", mbid: SONG, stars: 5 });
  });

  it("rolls back and explains a failed save", async () => {
    mockFetch({
      ...ME,
      "PUT /api/ratings": {
        status: 500,
        body: { error: { code: "internal_server_error", message: "Could not save" } },
      },
    });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    const slider = await pressEnd();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    expect(slider).toHaveAttribute("aria-valuenow", "3");
  });

  it("shows the community line and clears an explicit rating", async () => {
    const fetchMock = mockFetch({
      ...ME,
      [`DELETE /api/ratings/song/${SONG}`]: { body: { mbid: SONG, rating: UNRATED } },
    });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    expect(screen.getByText("3.7 from 12 ratings")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/ratings/song/${SONG}`,
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("explains a derived album rating", async () => {
    mockFetch(ME);
    const derived: RatingSummary = {
      mine: { stars: 3.7, is_derived: true, song_count: 3, review: null },
      community: { stars: 3.7, count: 1 },
    };
    renderWithProviders(<RatingControl kind="album" mbid={ALBUM} rating={derived} />);

    expect(
      await screen.findByText("3.7, average of your 3 song ratings. Rate to set your own."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("asks logged out visitors to log in", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    renderWithProviders(<RatingControl kind="album" mbid={ALBUM} rating={UNRATED} />, {
      path: "/albums/ok?tab=reviews",
    });

    expect(await screen.findByRole("link", { name: "Log in to rate" })).toHaveAttribute(
      "href",
      "/login?next=%2Falbums%2Fok%3Ftab%3Dreviews",
    );
    expect(screen.getByText("No ratings yet")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("needs stars before a review can be saved", async () => {
    mockFetch(ME);
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={UNRATED} />);

    await userEvent.click(await screen.findByRole("button", { name: "Write a review" }));

    expect(screen.getByRole("button", { name: "Save review" })).toBeDisabled();
    expect(screen.getByText("Pick a star rating first")).toBeInTheDocument();
  });

  it("saves a review with the current stars and closes the form", async () => {
    const fetchMock = mockFetch({ ...ME, "PUT /api/ratings": { body: { mbid: SONG, rating: RATED } } });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    await userEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    await userEvent.type(screen.getByLabelText("Your review"), "Still great");
    await userEvent.click(screen.getByRole("button", { name: "Save review" }));

    expect(await screen.findByRole("button", { name: "Write a review" })).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      kind: "song",
      mbid: SONG,
      stars: 3,
      review: "Still great",
    });
  });

  it("labels compact controls by title", async () => {
    mockFetch(ME);
    renderWithProviders(
      <RatingControl kind="song" mbid={SONG} rating={RATED} title="Airbag" compact />,
    );

    expect(await screen.findByRole("slider", { name: "Your rating for Airbag" })).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    expect(screen.queryByRole("button", { name: "Write a review" })).not.toBeInTheDocument();
  });
});
```

`web/src/features/ratings/ReviewList.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { ReviewList } from "./ReviewList";

const SONG = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
const FIRST_PAGE = `GET /api/songs/${SONG}/reviews?page=1`;

describe("ReviewList", () => {
  it("lists reviews with author, stars, and date", async () => {
    mockFetch({
      [FIRST_PAGE]: {
        body: {
          items: [
            {
              id: 1,
              user: { username: "bob" },
              stars: 4.5,
              review: "Instant classic",
              updated_at: "2026-10-02T18:30:00+00:00",
            },
          ],
          page: 1,
          pages: 1,
          total: 1,
        },
      },
    });
    renderWithProviders(<ReviewList kind="song" mbid={SONG} />);

    expect(await screen.findByText("Instant classic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "bob" })).toHaveAttribute("href", "/users/bob/history");
    expect(screen.getByRole("img", { name: "bob's rating: 4.5 out of 5" })).toBeInTheDocument();
    expect(screen.getByText("Oct 2, 2026")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mockFetch({ [FIRST_PAGE]: { body: { items: [], page: 1, pages: 0, total: 0 } } });
    renderWithProviders(<ReviewList kind="song" mbid={SONG} />);

    expect(await screen.findByText("No reviews yet")).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    const fetchMock = mockFetch({
      [FIRST_PAGE]: {
        status: 502,
        body: { error: { code: "catalog_unavailable", message: "Music catalog is unavailable, try again" } },
      },
    });
    renderWithProviders(<ReviewList kind="song" mbid={SONG} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Music catalog is unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/ratings`
Expected: FAIL, cannot resolve `./RatingControl` and `./ReviewList`

- [ ] **Step 3: Write the data hooks**

`web/src/features/ratings/api.ts`:

```ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Kind, Page, RatingSummary, Review } from "../../api/types";

interface RatingResponse {
  mbid: string;
  rating: RatingSummary;
}

interface Target {
  kind: Kind;
  mbid: string;
}

interface SaveRatingInput extends Target {
  stars: number;
  review?: string;
}

const RATED_QUERY_KEYS = [["artist"], ["album"], ["song"], ["reviews"], ["history"]];

function useInvalidateRated() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(RATED_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useSaveRating() {
  const invalidateRated = useInvalidateRated();
  return useMutation({
    mutationFn: (input: SaveRatingInput) => api.put<RatingResponse>("/ratings", input),
    onSuccess: invalidateRated,
  });
}

export function useClearRating() {
  const invalidateRated = useInvalidateRated();
  return useMutation({
    mutationFn: ({ kind, mbid }: Target) => api.delete<RatingResponse>(`/ratings/${kind}/${mbid}`),
    onSuccess: invalidateRated,
  });
}

export function useReviews(kind: Kind, mbid: string, page: number) {
  return useQuery({
    queryKey: ["reviews", kind, mbid, page],
    queryFn: () => api.get<Page<Review>>(`/${kind}s/${mbid}/reviews?page=${page}`),
    placeholderData: keepPreviousData,
  });
}
```

Returning the invalidation promise keeps the mutation pending until the refetched page arrives, so loading buttons stay busy for the whole round trip.

- [ ] **Step 4: Write RatingControl and ReviewComposer**

`web/src/features/ratings/RatingControl.tsx`:

```tsx
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { errorMessage } from "../../api/client";
import type { CommunityRating, Kind, RatingSummary } from "../../api/types";
import { Button, buttonClassName, Card, formatAverage, pluralize, Stars } from "../../ui";
import { loginHref } from "../auth/redirects";
import { useMe } from "../auth/useMe";
import { useClearRating, useSaveRating } from "./api";
import styles from "./RatingControl.module.css";
import { ReviewComposer } from "./ReviewComposer";

interface RatingControlProps {
  kind: Kind;
  mbid: string;
  rating: RatingSummary;
  title?: string;
  compact?: boolean;
}

function communityText({ stars, count }: CommunityRating): string {
  return stars === null ? "No ratings yet" : `${formatAverage(stars)} from ${pluralize(count, "rating")}`;
}

export function RatingControl({ kind, mbid, rating, title, compact = false }: RatingControlProps) {
  const { user } = useMe();
  const location = useLocation();
  const save = useSaveRating();
  const clear = useClearRating();
  const [stars, setStars] = useState(rating.mine?.stars ?? null);
  const [syncedRating, setSyncedRating] = useState(rating);
  const [composing, setComposing] = useState(false);

  // fresh server data replaces the optimistic value
  if (syncedRating !== rating) {
    setSyncedRating(rating);
    setStars(rating.mine?.stars ?? null);
  }

  const mine = rating.mine;
  const derived = mine?.is_derived && stars === mine.stars ? mine : null;
  const error = save.error ?? clear.error;
  const errorText = error && (
    <p role="alert" className={styles.error}>
      {errorMessage(error)}
    </p>
  );

  const rate = (next: number) => {
    const previous = stars;
    setStars(next);
    save.mutate({ kind, mbid, stars: next }, { onError: () => setStars(previous) });
  };

  if (compact) {
    return (
      <div className={styles.compact}>
        {user && (
          <Stars
            size="sm"
            value={stars}
            label={`Your rating for ${title ?? `this ${kind}`}`}
            onChange={rate}
          />
        )}
        <span className={styles.muted}>{communityText(rating.community)}</span>
        {errorText}
      </div>
    );
  }

  return (
    <Card className={styles.panel}>
      <div className={styles.columns}>
        <div className={styles.block}>
          <p className={styles.label}>Your rating</p>
          {user ? (
            <div className={styles.inline}>
              <Stars value={stars} label="Your rating" onChange={rate} />
              {mine && !mine.is_derived && (
                <Button
                  variant="ghost"
                  loading={clear.isPending}
                  onClick={() => clear.mutate({ kind, mbid })}
                >
                  Clear
                </Button>
              )}
            </div>
          ) : (
            <Link to={loginHref(location.pathname + location.search)} className={buttonClassName("secondary")}>
              Log in to rate
            </Link>
          )}
          {derived && (
            <p className={styles.muted}>
              {formatAverage(derived.stars)}, average of your{" "}
              {pluralize(derived.song_count, "song rating")}. Rate to set your own.
            </p>
          )}
        </div>
        <div className={styles.block}>
          <p className={styles.label}>Community</p>
          <div className={styles.inline}>
            <Stars size="sm" value={rating.community.stars} label="Community rating" />
            <span className={styles.muted}>{communityText(rating.community)}</span>
          </div>
        </div>
      </div>
      {user &&
        (composing ? (
          <ReviewComposer
            kind={kind}
            mbid={mbid}
            stars={derived ? null : stars}
            review={mine?.review ?? null}
            onDone={() => setComposing(false)}
          />
        ) : (
          <Button onClick={() => setComposing(true)}>
            {mine?.review ? "Edit review" : "Write a review"}
          </Button>
        ))}
      {errorText}
    </Card>
  );
}
```

A derived album average like 3.7 is not a valid half star input, so the composer treats it as no rating and asks for a real one.

`web/src/features/ratings/ReviewComposer.tsx`:

```tsx
import { type FormEvent, useState } from "react";
import { errorMessage } from "../../api/client";
import type { Kind } from "../../api/types";
import { Button, TextArea } from "../../ui";
import { useSaveRating } from "./api";
import styles from "./RatingControl.module.css";

const REVIEW_MAX_LENGTH = 2000;

interface ReviewComposerProps {
  kind: Kind;
  mbid: string;
  stars: number | null;
  review: string | null;
  onDone: () => void;
}

export function ReviewComposer({ kind, mbid, stars, review, onDone }: ReviewComposerProps) {
  const [text, setText] = useState(review ?? "");
  const save = useSaveRating();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (stars === null) return;
    save.mutate({ kind, mbid, stars, review: text }, { onSuccess: onDone });
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      <TextArea
        label="Your review"
        value={text}
        maxLength={REVIEW_MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
        error={save.error ? errorMessage(save.error) : undefined}
      />
      {stars === null && <p className={styles.muted}>Pick a star rating first</p>}
      <div className={styles.inline}>
        <Button type="submit" variant="primary" loading={save.isPending} disabled={stars === null}>
          Save review
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

`web/src/features/ratings/RatingControl.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-6);
}

.columns {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.label {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: var(--leading-xs);
  text-transform: uppercase;
}

.inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.compact {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.composer {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-self: stretch;
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

.error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}
```

- [ ] **Step 5: Write ReviewList**

`web/src/features/ratings/ReviewList.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router";
import type { Kind } from "../../api/types";
import { ErrorNotice, formatDate, Notice, Pagination, Skeleton, Stars } from "../../ui";
import { useReviews } from "./api";
import styles from "./ReviewList.module.css";

interface ReviewListProps {
  kind: Kind;
  mbid: string;
}

// pages wrap this in their own Reviews section, the key resets paging for a new item
export function ReviewList({ kind, mbid }: ReviewListProps) {
  return <ReviewListBody key={`${kind}:${mbid}`} kind={kind} mbid={mbid} />;
}

function ReviewListBody({ kind, mbid }: ReviewListProps) {
  const [page, setPage] = useState(1);
  const reviews = useReviews(kind, mbid, page);

  if (reviews.isPending) return <ReviewSkeleton />;
  if (reviews.isError) return <ErrorNotice error={reviews.error} onRetry={() => reviews.refetch()} />;
  if (reviews.data.items.length === 0) {
    return <Notice title="No reviews yet">Rate this {kind} and write the first one.</Notice>;
  }

  return (
    <>
      <ol className={styles.list}>
        {reviews.data.items.map((review) => (
          <li key={review.id} className={styles.review}>
            <div className={styles.meta}>
              <Link to={`/users/${review.user.username}/history`} className={styles.author}>
                {review.user.username}
              </Link>
              <Stars size="sm" value={review.stars} label={`${review.user.username}'s rating`} />
              <time dateTime={review.updated_at} className={styles.date}>
                {formatDate(review.updated_at)}
              </time>
            </div>
            <p className={styles.body}>{review.review}</p>
          </li>
        ))}
      </ol>
      <Pagination page={page} pages={reviews.data.pages} onPageChange={setPage} />
    </>
  );
}

function ReviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading reviews" className={styles.list}>
      {[0, 1, 2].map((row) => (
        <div key={row} className={styles.review}>
          <Skeleton width="40%" height="var(--leading-sm)" />
          <Skeleton height="var(--space-12)" />
        </div>
      ))}
    </div>
  );
}
```

`web/src/features/ratings/ReviewList.module.css`:

```css
.list {
  display: flex;
  flex-direction: column;
  padding: 0;
  list-style: none;
}

.review {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-border);
}

.review:first-child {
  padding-top: 0;
  border-top: 0;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

.author {
  font-weight: 600;
}

.date {
  color: var(--color-text-muted);
}

.body {
  overflow-wrap: anywhere;
  white-space: pre-line;
}
```

`white-space: pre-line` keeps the line breaks people type, and `overflow-wrap: anywhere` stops a pasted URL from pushing the page wider than a 375px screen.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/features/ratings`
Expected: 11 passed

- [ ] **Step 7: Run every web check**

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, lint reports no errors, and the build succeeds.

- [ ] **Step 8: Check it by hand**

With slices 04 and 05 merged, run both servers and log in, then call the API from the browser console on `http://localhost:5173`:

```js
await fetch("/api/ratings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "song", mbid: "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3", stars: 4.5, review: "Still great" }) }).then((r) => r.json())
await fetch("/api/songs/9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3/reviews").then((r) => r.json())
```

Expected: the first call returns `mine.stars` 4.5, and the second lists one review by your username. The components get their visual check once slice 06 mounts them on the catalog pages.

- [ ] **Step 9: Commit, push, and open the pull request**

```bash
git add web/src/features/ratings
git commit -m "feat(web): add rating control, review composer, and review list"
git push -u origin slice/07-ratings-reviews
gh pr create --base main --title "Ratings and reviews" --body "Slice 07. Unblocks the page tasks in slice 06, which mount RatingControl and ReviewList."
```
