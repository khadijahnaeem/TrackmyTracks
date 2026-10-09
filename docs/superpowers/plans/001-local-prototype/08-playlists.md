# Slice 08 Playlists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users create public or private playlists, add songs from anywhere a song appears, and reorder or remove them.

**Architecture:** Thin routes in `app/playlists/routes.py` over helpers in `app/playlists/service.py`. One helper loads a playlist the viewer may see, one loads a playlist the user owns, and both answer 404 so private playlists never leak. Song changes lock the playlist row with `FOR UPDATE`, keep positions dense from 1 to n, and return the full playlist so the client replaces its cache without refetching. On the web, one hooks module owns every playlist query and mutation. `AddToPlaylistButton` is a small popover the catalog pages mount.

**Tech Stack:** Flask, SQLAlchemy 2.0, pytest, React 19, TanStack Query 5, React Router 7, CSS Modules, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/001-local-prototype-design.md`

**Index:** `docs/superpowers/plans/001-local-prototype.md`. Its Global Constraints and Contracts apply to every task here.

**Branch:** `slice/08-playlists`. Requires slice 04 merged and slice 05 Task 1 merged for `public_user`.

**Phases:** Tasks 3 and 4 run in A1 against the mock, and [003](../003-ui-first.md) Task 8 adds the playlist handlers. Tasks 1 and 2 run in B.

**Merge early:** open a pull request after Task 3, because slice 06's pages import `AddToPlaylistButton`. Continue Task 4 on the same branch.

---

## File map

```
api/
  app/playlists/service.py       visibility and ownership helpers, serializers, renumber, touch
  app/playlists/routes.py        every playlist route
  tests/playlists/__init__.py
  tests/playlists/conftest.py    make_playlist, songs
  tests/playlists/test_playlist_crud.py
  tests/playlists/test_playlist_songs.py
web/
  src/features/playlists/api.ts             queries and mutations
  src/features/playlists/AddToPlaylistButton.tsx, AddToPlaylistButton.module.css
  src/features/playlists/AddToPlaylistButton.test.tsx
  src/features/playlists/PlaylistForm.tsx, PlaylistForm.module.css
  src/features/playlists/UserPlaylistsPage.tsx, UserPlaylistsPage.module.css
  src/features/playlists/PlaylistPage.tsx, PlaylistPage.module.css
  src/features/playlists/pages.test.tsx
  src/features/playlists/routes.ts
```

## Behavior summary

| Action | Who | Result |
|---|---|---|
| List a user's playlists | anyone | public ones, plus private ones when viewing your own, newest change first |
| Read a playlist | anyone for public, owner for private | others get 404 for a private playlist |
| Create, edit, delete | logged in owner | others get 404, never 403 |
| Add, remove, reorder songs | owner | full `PlaylistDetail` back, `updated_at` bumped |

Positions stay dense from 1 to n. Add appends at n + 1, remove renumbers, and reorder rewrites them all inside one transaction that relies on the deferred unique constraint from slice 02.

---

### Task 1: Playlist CRUD

**Files:**
- Create: `api/app/playlists/service.py`
- Modify: `api/app/playlists/routes.py`
- Create: `api/tests/playlists/__init__.py`, `api/tests/playlists/conftest.py`
- Test: `api/tests/playlists/test_playlist_crud.py`

**Interfaces:**
- Consumes: `Playlist`, `PlaylistSong`, `User`, `current_user`, `require_user`, `json_body`, `required_text`, `optional_text`, `ValidationError`, `NotFound`, `song_summary`, `public_user`
- Produces:
  - `visible_playlist_or_404(playlist_id: int, viewer: User | None) -> Playlist`
  - `owned_playlist_or_404(playlist_id: int, user: User, lock: bool = False) -> Playlist`
  - `song_counts(playlist_ids: list[int]) -> dict[int, int]`
  - `renumber(entries: list[PlaylistSong]) -> None`, `touch(playlist: Playlist) -> None`
  - `playlist_payload(playlist, song_count) -> dict`, `playlist_detail(playlist) -> dict`
  - Routes `GET /api/users/<username>/playlists`, `POST /api/playlists`, `GET|PATCH|DELETE /api/playlists/<int:id>`
  - Test fixtures `make_playlist(owner, name="Late nights", is_public=True, songs=())` and `songs`, three songs titled Airbag, Lucky, Let Down

Datetimes go out as `isoformat()` strings, which `formatDate` on the web parses.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b slice/08-playlists
```

- [ ] **Step 2: Write the test fixtures and failing tests**

`api/tests/playlists/__init__.py` is empty.

`api/tests/playlists/conftest.py`:

```python
import pytest

from app.extensions import db
from app.models import Playlist, PlaylistSong


@pytest.fixture
def make_playlist():
    def make(owner, name="Late nights", is_public=True, songs=()) -> Playlist:
        entries = [PlaylistSong(song=song, position=i) for i, song in enumerate(songs, 1)]
        playlist = Playlist(owner=owner, name=name, is_public=is_public, entries=entries)
        db.session.add(playlist)
        db.session.commit()
        return playlist

    return make


@pytest.fixture
def songs(make_artist, make_song):
    artist = make_artist()
    return [make_song(artist, title) for title in ("Airbag", "Lucky", "Let Down")]
```

`api/tests/playlists/test_playlist_crud.py`:

```python
from unittest.mock import ANY

import pytest


def test_create_requires_login(client):
    assert client.post("/api/playlists", json={"name": "Mix"}).status_code == 401


def test_create_trims_and_defaults_to_public(client, login, make_user):
    login(make_user())

    response = client.post(
        "/api/playlists", json={"name": "  Late nights  ", "description": "   "}
    )

    assert response.status_code == 201
    assert response.json == {
        "id": ANY,
        "name": "Late nights",
        "description": None,
        "is_public": True,
        "owner": {"username": "alice"},
        "song_count": 0,
        "updated_at": ANY,
    }


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({"name": "  "}, "Name is required"),
        ({"name": "x" * 101}, "Name must be 100 characters or fewer"),
        ({"name": "Mix", "description": "x" * 501}, "Description must be 500 characters or fewer"),
        ({"name": "Mix", "is_public": "yes"}, "Visibility must be true or false"),
    ],
)
def test_create_validates(client, login, make_user, body, message):
    login(make_user())

    response = client.post("/api/playlists", json=body)

    assert response.status_code == 422
    assert response.json["error"]["message"] == message


def test_list_shows_private_only_to_owner_with_counts(
    client, login, make_user, make_playlist, songs
):
    alice = make_user()
    make_playlist(alice, "Public mix", songs=songs[:2])
    make_playlist(alice, "Drafts", is_public=False)

    def names_and_counts():
        items = client.get("/api/users/alice/playlists").json["items"]
        return [(item["name"], item["song_count"]) for item in items]

    assert names_and_counts() == [("Public mix", 2)]
    login(make_user("bob"))
    assert names_and_counts() == [("Public mix", 2)]
    login(alice)
    assert names_and_counts() == [("Drafts", 0), ("Public mix", 2)]


def test_list_for_unknown_user_is_404(client):
    assert client.get("/api/users/nobody/playlists").status_code == 404


def test_detail_lists_songs_in_order(client, make_user, make_playlist, songs):
    playlist = make_playlist(make_user(), songs=songs)

    response = client.get(f"/api/playlists/{playlist.id}")

    assert [song["title"] for song in response.json["songs"]] == ["Airbag", "Lucky", "Let Down"]
    assert response.json["song_count"] == 3


def test_private_playlist_is_hidden_from_others(client, login, make_user, make_playlist):
    alice = make_user()
    url = f"/api/playlists/{make_playlist(alice, is_public=False).id}"

    assert client.get(url).status_code == 404
    login(make_user("bob"))
    assert client.get(url).status_code == 404
    login(alice)
    assert client.get(url).json["name"] == "Late nights"


def test_owner_updates_fields_partially(client, login, make_user, make_playlist):
    alice = make_user()
    playlist = make_playlist(alice)
    login(alice)

    response = client.patch(
        f"/api/playlists/{playlist.id}", json={"is_public": False, "description": "For the drive"}
    )

    assert response.status_code == 200
    assert (response.json["name"], response.json["description"], response.json["is_public"]) == (
        "Late nights",
        "For the drive",
        False,
    )


def test_only_owner_can_change_or_delete(client, login, make_user, make_playlist):
    url = f"/api/playlists/{make_playlist(make_user()).id}"
    login(make_user("bob"))

    assert client.patch(url, json={"name": "Mine now"}).status_code == 404
    assert client.delete(url).status_code == 404


def test_owner_deletes_playlist(client, login, make_user, make_playlist, songs):
    alice = make_user()
    url = f"/api/playlists/{make_playlist(alice, songs=songs).id}"
    login(alice)

    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/playlists/test_playlist_crud.py -v`
Expected: FAIL. `test_create_requires_login` gets 404 instead of 401 because no route exists yet, and the rest fail on missing routes.

- [ ] **Step 4: Write the service**

`api/app/playlists/service.py`:

```python
from sqlalchemy import func, select

from app.auth.serializers import public_user
from app.catalog.serializers import song_summary
from app.errors import NotFound
from app.extensions import db
from app.models import Playlist, PlaylistSong, User


def _owns(user: User | None, playlist: Playlist) -> bool:
    return user is not None and user.id == playlist.user_id


def visible_playlist_or_404(playlist_id: int, viewer: User | None) -> Playlist:
    playlist = db.session.get(Playlist, playlist_id)
    if playlist is None or not (playlist.is_public or _owns(viewer, playlist)):
        raise NotFound("Playlist not found")
    return playlist


def owned_playlist_or_404(playlist_id: int, user: User, lock: bool = False) -> Playlist:
    # FOR UPDATE serializes concurrent edits to the same playlist
    playlist = db.session.get(Playlist, playlist_id, with_for_update=lock, populate_existing=lock)
    if playlist is None or not _owns(user, playlist):
        raise NotFound("Playlist not found")
    return playlist


def song_counts(playlist_ids: list[int]) -> dict[int, int]:
    rows = db.session.execute(
        select(PlaylistSong.playlist_id, func.count())
        .where(PlaylistSong.playlist_id.in_(playlist_ids))
        .group_by(PlaylistSong.playlist_id)
    )
    return dict(rows.tuples().all())


def renumber(entries: list[PlaylistSong]) -> None:
    for position, entry in enumerate(entries, 1):
        entry.position = position


def touch(playlist: Playlist) -> None:
    playlist.updated_at = func.now()


def playlist_payload(playlist: Playlist, song_count: int) -> dict:
    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": playlist.description,
        "is_public": playlist.is_public,
        "owner": public_user(playlist.owner),
        "song_count": song_count,
        "updated_at": playlist.updated_at.isoformat(),
    }


def playlist_detail(playlist: Playlist) -> dict:
    songs = [song_summary(entry.song) for entry in playlist.entries]
    return {**playlist_payload(playlist, len(songs)), "songs": songs}
```

- [ ] **Step 5: Write the routes**

Replace `api/app/playlists/routes.py`:

```python
from flask import Blueprint
from sqlalchemy import select

from app.auth.session import current_user, require_user
from app.errors import NotFound, ValidationError
from app.extensions import db
from app.http import json_body, optional_text, required_text
from app.models import Playlist, User
from app.playlists.service import (
    owned_playlist_or_404,
    playlist_detail,
    playlist_payload,
    song_counts,
    visible_playlist_or_404,
)

bp = Blueprint("playlists", __name__, url_prefix="/api")


def _fields(data: dict, partial: bool) -> dict:
    fields = {}
    if not partial or "name" in data:
        fields["name"] = required_text(data, "name", 100)
    if "description" in data:
        fields["description"] = optional_text(data, "description", 500)
    if "is_public" in data:
        if not isinstance(data["is_public"], bool):
            raise ValidationError("Visibility must be true or false")
        fields["is_public"] = data["is_public"]
    return fields


@bp.get("/users/<username>/playlists")
def user_playlists(username: str):
    owner = db.session.scalar(select(User).filter_by(username=username))
    if owner is None:
        raise NotFound("User not found")
    query = (
        select(Playlist)
        .where(Playlist.user_id == owner.id)
        .order_by(Playlist.updated_at.desc(), Playlist.id.desc())
    )
    viewer = current_user()
    if viewer is None or viewer.id != owner.id:
        query = query.where(Playlist.is_public)
    playlists = db.session.scalars(query).all()
    counts = song_counts([playlist.id for playlist in playlists])
    return {"items": [playlist_payload(p, counts.get(p.id, 0)) for p in playlists]}


@bp.post("/playlists")
def create_playlist():
    user = require_user()
    playlist = Playlist(owner=user, **_fields(json_body(), partial=False))
    db.session.add(playlist)
    db.session.commit()
    return playlist_payload(playlist, 0), 201


@bp.get("/playlists/<int:playlist_id>")
def get_playlist(playlist_id: int):
    return playlist_detail(visible_playlist_or_404(playlist_id, current_user()))


@bp.patch("/playlists/<int:playlist_id>")
def update_playlist(playlist_id: int):
    playlist = owned_playlist_or_404(playlist_id, require_user())
    for name, value in _fields(json_body(), partial=True).items():
        setattr(playlist, name, value)
    db.session.commit()
    return playlist_payload(playlist, len(playlist.entries))


@bp.delete("/playlists/<int:playlist_id>")
def delete_playlist(playlist_id: int):
    db.session.delete(owned_playlist_or_404(playlist_id, require_user()))
    db.session.commit()
    return "", 204
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest tests/playlists/test_playlist_crud.py -v`
Expected: 13 passed

- [ ] **Step 7: Lint, format, and commit**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): add playlist create, read, update, and delete"
```

### Task 2: Playlist songs

**Files:**
- Modify: `api/app/playlists/routes.py`
- Test: `api/tests/playlists/test_playlist_songs.py`

**Interfaces:**
- Consumes: Task 1, `get_or_cache_song`, `Conflict`, the `fake_mb` fixture and `KARMA_POLICE`
- Produces: `POST /api/playlists/<id>/songs {mbid}` 201, `DELETE /api/playlists/<id>/songs/<uuid:mbid>`, `PUT /api/playlists/<id>/songs {mbids}`, each returning `PlaylistDetail`, plus `MAX_SONGS = 500` in `app/playlists/routes.py`

The cap test patches `MAX_SONGS` to 1. The rule under test is the comparison, and a cap of 1 checks it without writing 500 rows. A separate test pins the real value.

- [ ] **Step 1: Write the failing tests**

`api/tests/playlists/test_playlist_songs.py`:

```python
import pytest

from tests.fakes import KARMA_POLICE


@pytest.fixture
def alice(make_user, login):
    user = make_user()
    login(user)
    return user


def _titles(response) -> list[str]:
    return [song["title"] for song in response.json["songs"]]


def test_add_caches_a_new_song(client, alice, make_playlist, fake_mb):
    playlist = make_playlist(alice)

    response = client.post(f"/api/playlists/{playlist.id}/songs", json={"mbid": KARMA_POLICE})

    assert response.status_code == 201
    assert _titles(response) == ["Karma Police"]
    assert f"/recording/{KARMA_POLICE}" in fake_mb.calls


def test_add_appends_to_the_end(client, alice, make_playlist, songs):
    playlist = make_playlist(alice, songs=songs[:2])

    response = client.post(f"/api/playlists/{playlist.id}/songs", json={"mbid": songs[2].mbid})

    assert _titles(response) == ["Airbag", "Lucky", "Let Down"]


def test_adding_twice_conflicts(client, alice, make_playlist, songs):
    playlist = make_playlist(alice, songs=songs[:1])

    response = client.post(f"/api/playlists/{playlist.id}/songs", json={"mbid": songs[0].mbid})

    assert response.status_code == 409
    assert response.json["error"]["message"] == "Song is already in this playlist"


def test_add_rejects_a_bad_mbid(client, alice, make_playlist):
    playlist = make_playlist(alice)

    response = client.post(f"/api/playlists/{playlist.id}/songs", json={"mbid": "nope"})

    assert response.status_code == 422


def test_add_stops_at_the_cap(client, alice, make_playlist, songs, monkeypatch):
    monkeypatch.setattr("app.playlists.routes.MAX_SONGS", 1)
    playlist = make_playlist(alice, songs=songs[:1])

    response = client.post(f"/api/playlists/{playlist.id}/songs", json={"mbid": songs[1].mbid})

    assert response.status_code == 422


def test_cap_is_500():
    from app.playlists.routes import MAX_SONGS

    assert MAX_SONGS == 500


def test_add_bumps_updated_at(client, alice, make_playlist, songs):
    playlist = make_playlist(alice)
    before = client.get(f"/api/playlists/{playlist.id}").json["updated_at"]

    after = client.post(
        f"/api/playlists/{playlist.id}/songs", json={"mbid": songs[0].mbid}
    ).json["updated_at"]

    assert after > before


def test_remove_renumbers_the_rest(client, alice, make_playlist, songs):
    playlist = make_playlist(alice, songs=songs)

    response = client.delete(f"/api/playlists/{playlist.id}/songs/{songs[1].mbid}")

    assert _titles(response) == ["Airbag", "Let Down"]
    assert [entry.position for entry in playlist.entries] == [1, 2]


def test_remove_missing_song_is_404(client, alice, make_playlist, songs):
    playlist = make_playlist(alice, songs=songs[:1])

    response = client.delete(f"/api/playlists/{playlist.id}/songs/{songs[2].mbid}")

    assert response.status_code == 404


def test_reorder_rewrites_positions(client, alice, make_playlist, songs):
    playlist = make_playlist(alice, songs=songs)
    order = [songs[2].mbid, songs[0].mbid, songs[1].mbid]

    response = client.put(f"/api/playlists/{playlist.id}/songs", json={"mbids": order})

    assert response.status_code == 200
    assert _titles(response) == ["Let Down", "Airbag", "Lucky"]


@pytest.mark.parametrize(
    "pick",
    [
        lambda s: [s[0].mbid, s[1].mbid],
        lambda s: [s[0].mbid, s[0].mbid, s[1].mbid],
        lambda s: "not a list",
    ],
    ids=["missing", "duplicate", "not a list"],
)
def test_reorder_requires_every_song_once(client, alice, make_playlist, songs, pick):
    playlist = make_playlist(alice, songs=songs)

    response = client.put(f"/api/playlists/{playlist.id}/songs", json={"mbids": pick(songs)})

    assert response.status_code == 422


def test_song_routes_are_owner_only(client, login, make_user, make_playlist, songs, fake_mb):
    playlist = make_playlist(make_user(), songs=songs[:1])
    login(make_user("bob"))
    base = f"/api/playlists/{playlist.id}/songs"

    assert client.post(base, json={"mbid": KARMA_POLICE}).status_code == 404
    assert client.delete(f"{base}/{songs[0].mbid}").status_code == 404
    assert client.put(base, json={"mbids": [songs[0].mbid]}).status_code == 404
    assert fake_mb.calls == []
```

The last assertion shows ownership is checked before any catalog lookup.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/playlists/test_playlist_songs.py -v`
Expected: FAIL with 405 or 404 responses because the song routes do not exist yet, and `test_cap_is_500` fails with `ImportError`

- [ ] **Step 3: Write the implementation**

In `api/app/playlists/routes.py`, add `import uuid` at the top, add `from app.catalog.service import get_or_cache_song`, add `Conflict` to the `app.errors` import, add `PlaylistSong` to the `app.models` import, and add `renumber` and `touch` to the `app.playlists.service` import. Then add this constant below `bp`:

```python
MAX_SONGS = 500
```

Add this helper below `_fields`:

```python
def _mbid(data: dict) -> str:
    try:
        return str(uuid.UUID(data.get("mbid")))
    except (TypeError, ValueError, AttributeError):
        raise ValidationError("A valid MusicBrainz ID is required") from None
```

Append the routes:

```python
@bp.post("/playlists/<int:playlist_id>/songs")
def add_song(playlist_id: int):
    user = require_user()
    mbid = _mbid(json_body())
    owned_playlist_or_404(playlist_id, user)
    song = get_or_cache_song(mbid)
    # caching commits, so the row lock is taken after it
    playlist = owned_playlist_or_404(playlist_id, user, lock=True)
    if any(entry.song_id == song.id for entry in playlist.entries):
        raise Conflict("Song is already in this playlist")
    if len(playlist.entries) >= MAX_SONGS:
        raise ValidationError(f"Playlists hold up to {MAX_SONGS} songs")
    playlist.entries.append(PlaylistSong(song=song, position=len(playlist.entries) + 1))
    touch(playlist)
    db.session.commit()
    return playlist_detail(playlist), 201


@bp.delete("/playlists/<int:playlist_id>/songs/<uuid:mbid>")
def remove_song(playlist_id: int, mbid: uuid.UUID):
    playlist = owned_playlist_or_404(playlist_id, require_user(), lock=True)
    entry = next((e for e in playlist.entries if e.song.mbid == str(mbid)), None)
    if entry is None:
        raise NotFound("Song is not in this playlist")
    playlist.entries.remove(entry)
    renumber(playlist.entries)
    touch(playlist)
    db.session.commit()
    return playlist_detail(playlist)


@bp.put("/playlists/<int:playlist_id>/songs")
def reorder_songs(playlist_id: int):
    user = require_user()
    mbids = json_body().get("mbids")
    if not isinstance(mbids, list) or not all(isinstance(mbid, str) for mbid in mbids):
        raise ValidationError("Mbids must be a list of MusicBrainz IDs")
    playlist = owned_playlist_or_404(playlist_id, user, lock=True)
    by_mbid = {entry.song.mbid: entry for entry in playlist.entries}
    if len(mbids) != len(by_mbid) or set(mbids) != set(by_mbid):
        raise ValidationError("Reorder must list every song in the playlist exactly once")
    renumber([by_mbid[mbid] for mbid in mbids])
    touch(playlist)
    db.session.commit()
    return playlist_detail(playlist)
```

`entries` uses `delete-orphan`, so removing an entry from the list deletes its row. Positions stay dense, which is why add can use `len + 1`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/playlists -v`
Expected: 27 passed

- [ ] **Step 5: Lint, format, and commit**

```bash
ruff format . && ruff check .
pytest
git add api/
git commit -m "feat(api): add, remove, and reorder playlist songs"
```

### Task 3: Playlist hooks and AddToPlaylistButton

**Files:**
- Create: `web/src/features/playlists/api.ts`
- Create: `web/src/features/playlists/AddToPlaylistButton.tsx`, `AddToPlaylistButton.module.css`
- Test: `web/src/features/playlists/AddToPlaylistButton.test.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError`, `errorMessage`, `Playlist`, `PlaylistDetail`, `useMe`, `Button`, `buttonClassName`, `Skeleton`, `TextField`, `mockFetch`, `renderWithProviders`
- Produces:
  - `PlaylistFields { name, description: string | null, is_public }`
  - `useUserPlaylists(username)` returning `Playlist[]` as `data`, `usePlaylist(id)`, `useCreatePlaylist()`, `useUpdatePlaylist(id)`, `useDeletePlaylist(id)`, `useAddSong()` taking `{playlistId, mbid}`, `useRemoveSong(id)` taking an mbid, `useReorderSongs(id)` taking an mbid list
  - `AddToPlaylistButton({mbid})`

Song mutations write the returned `PlaylistDetail` into `["playlist", id]` and invalidate `["playlists"]`. The popover is a non-modal dialog (`aria-haspopup="dialog"`) rather than an ARIA menu, because it holds a form and a menu role would promise arrow key navigation it does not need. Escape closes it and returns focus to the trigger. A click outside closes it and leaves focus where the click landed.

- [ ] **Step 1: Write the failing tests**

`web/src/features/playlists/AddToPlaylistButton.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Playlist, PlaylistDetail } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { AddToPlaylistButton } from "./AddToPlaylistButton";

const MBID = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
const ALICE = { id: 1, username: "alice", email: "alice@example.com" };

function playlist(id: number, name: string): Playlist {
  return {
    id,
    name,
    description: null,
    is_public: true,
    owner: { username: "alice" },
    song_count: 0,
    updated_at: "2026-10-02T18:30:00+00:00",
  };
}

function detail(id: number, name: string): PlaylistDetail {
  return { ...playlist(id, name), song_count: 1, songs: [] };
}

function loggedIn(playlists: Playlist[]) {
  return {
    "GET /api/auth/me": { body: { user: ALICE } },
    "GET /api/users/alice/playlists": { body: { items: playlists } },
  };
}

async function openPicker() {
  // the disabled placeholder shown while loading has no aria-expanded
  await userEvent.click(
    await screen.findByRole("button", { name: "Add to playlist", expanded: false }),
  );
}

describe("AddToPlaylistButton", () => {
  it("asks logged out visitors to log in and come back", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />, { path: "/songs/abc" });

    expect(await screen.findByRole("link", { name: "Log in to add" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsongs%2Fabc",
    );
  });

  it("adds the song to a chosen playlist", async () => {
    mockFetch({
      ...loggedIn([playlist(1, "Late nights")]),
      "POST /api/playlists/1/songs": { status: 201, body: detail(1, "Late nights") },
    });
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />);

    await openPicker();
    await userEvent.click(await screen.findByRole("button", { name: "Late nights" }));

    expect(await screen.findByRole("button", { name: "Late nights Added" })).toBeDisabled();
  });

  it("reports a song that is already there", async () => {
    mockFetch({
      ...loggedIn([playlist(1, "Late nights")]),
      "POST /api/playlists/1/songs": {
        status: 409,
        body: { error: { code: "conflict", message: "Song is already in this playlist" } },
      },
    });
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />);

    await openPicker();
    await userEvent.click(await screen.findByRole("button", { name: "Late nights" }));

    expect(await screen.findByRole("button", { name: "Late nights Already added" })).toBeDisabled();
  });

  it("creates a playlist and adds the song in one step", async () => {
    const fetchMock = mockFetch({
      ...loggedIn([]),
      "POST /api/playlists": { status: 201, body: playlist(2, "Road trip") },
      "POST /api/playlists/2/songs": { status: 201, body: detail(2, "Road trip") },
    });
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />);

    await openPicker();
    expect(await screen.findByText("No playlists yet, create one below.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("New playlist"), "Road trip");
    await userEvent.click(screen.getByRole("button", { name: "Create and add" }));

    expect(await screen.findByText("Added to Road trip")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/playlists",
      expect.objectContaining({
        body: JSON.stringify({ name: "Road trip", description: null, is_public: true }),
      }),
    );
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    mockFetch(loggedIn([]));
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />);

    await openPicker();
    expect(screen.getByRole("dialog", { name: "Add to playlist" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to playlist" })).toHaveFocus();
  });

  it("closes on a click outside", async () => {
    mockFetch(loggedIn([]));
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />);

    await openPicker();
    await userEvent.click(document.body);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/playlists/AddToPlaylistButton.test.tsx`
Expected: FAIL, cannot resolve `./AddToPlaylistButton`

- [ ] **Step 3: Write the hooks**

`web/src/features/playlists/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Playlist, PlaylistDetail } from "../../api/types";

export interface PlaylistFields {
  name: string;
  description: string | null;
  is_public: boolean;
}

export function useUserPlaylists(username: string) {
  return useQuery({
    queryKey: ["playlists", username],
    queryFn: () =>
      api.get<{ items: Playlist[] }>(`/users/${encodeURIComponent(username)}/playlists`),
    select: (data) => data.items,
  });
}

export function usePlaylist(id: number) {
  return useQuery({
    queryKey: ["playlist", id],
    queryFn: () => api.get<PlaylistDetail>(`/playlists/${id}`),
  });
}

// song changes return the whole playlist, so the cache is replaced instead of refetched
function useStoreDetail() {
  const queryClient = useQueryClient();
  return (detail: PlaylistDetail) => {
    queryClient.setQueryData(["playlist", detail.id], detail);
    return queryClient.invalidateQueries({ queryKey: ["playlists"] });
  };
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: PlaylistFields) => api.post<Playlist>("/playlists", fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useUpdatePlaylist(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: PlaylistFields) => api.patch<Playlist>(`/playlists/${id}`, fields),
    onSuccess: (playlist) => {
      queryClient.setQueryData<PlaylistDetail>(
        ["playlist", id],
        (detail) => detail && { ...detail, ...playlist },
      );
      return queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

export function useDeletePlaylist(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>(`/playlists/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useAddSong() {
  const storeDetail = useStoreDetail();
  return useMutation({
    mutationFn: ({ playlistId, mbid }: { playlistId: number; mbid: string }) =>
      api.post<PlaylistDetail>(`/playlists/${playlistId}/songs`, { mbid }),
    onSuccess: storeDetail,
  });
}

export function useRemoveSong(id: number) {
  const storeDetail = useStoreDetail();
  return useMutation({
    mutationFn: (mbid: string) => api.delete<PlaylistDetail>(`/playlists/${id}/songs/${mbid}`),
    onSuccess: storeDetail,
  });
}

export function useReorderSongs(id: number) {
  const storeDetail = useStoreDetail();
  return useMutation({
    mutationFn: (mbids: string[]) => api.put<PlaylistDetail>(`/playlists/${id}/songs`, { mbids }),
    onSuccess: storeDetail,
  });
}
```

- [ ] **Step 4: Write the component**

`web/src/features/playlists/AddToPlaylistButton.tsx`:

```tsx
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { ApiError, errorMessage } from "../../api/client";
import { Button, buttonClassName, Skeleton, TextField } from "../../ui";
import { loginHref } from "../auth/redirects";
import { useMe } from "../auth/useMe";
import { useAddSong, useCreatePlaylist, useUserPlaylists } from "./api";
import styles from "./AddToPlaylistButton.module.css";

type AddStatus = "pending" | "added" | "exists" | "failed";

const STATUS_LABELS: Record<Exclude<AddStatus, "pending">, string> = {
  added: "Added",
  exists: "Already added",
  failed: "Try again",
};

export function AddToPlaylistButton({ mbid }: { mbid: string }) {
  const { user, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) {
    return (
      <Button variant="ghost" disabled>
        Add to playlist
      </Button>
    );
  }
  if (!user) {
    return (
      <Link to={loginHref(location.pathname + location.search)} className={buttonClassName("ghost")}>
        Log in to add
      </Link>
    );
  }
  return <PlaylistPicker username={user.username} mbid={mbid} />;
}

function PlaylistPicker({ username, mbid }: { username: string; mbid: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <Button
        ref={triggerRef}
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        Add to playlist
      </Button>
      {open && (
        <div id={panelId} role="dialog" aria-label="Add to playlist" className={styles.panel}>
          <PlaylistChoices username={username} mbid={mbid} />
          <NewPlaylistForm mbid={mbid} />
        </div>
      )}
    </div>
  );
}

function PlaylistChoices({ username, mbid }: { username: string; mbid: string }) {
  const playlists = useUserPlaylists(username);
  const addSong = useAddSong();
  const [statuses, setStatuses] = useState<Record<number, AddStatus>>({});

  if (playlists.isPending) {
    return (
      <div className={styles.list} aria-busy="true">
        <Skeleton height="var(--control-height)" />
        <Skeleton height="var(--control-height)" />
      </div>
    );
  }
  if (playlists.isError) return <p className={styles.note}>{errorMessage(playlists.error)}</p>;
  if (playlists.data.length === 0) {
    return <p className={styles.note}>No playlists yet, create one below.</p>;
  }

  const setStatus = (playlistId: number, status: AddStatus) =>
    setStatuses((current) => ({ ...current, [playlistId]: status }));

  // mutateAsync settles every call, mutate callbacks only fire for the latest one
  const add = (playlistId: number) => {
    setStatus(playlistId, "pending");
    addSong
      .mutateAsync({ playlistId, mbid })
      .then(() => setStatus(playlistId, "added"))
      .catch((error: unknown) => {
        const exists = error instanceof ApiError && error.status === 409;
        setStatus(playlistId, exists ? "exists" : "failed");
      });
  };

  return (
    <ul className={styles.list}>
      {playlists.data.map((playlist) => {
        const status = statuses[playlist.id];
        return (
          <li key={playlist.id}>
            <Button
              variant="ghost"
              className={styles.choice}
              loading={status === "pending"}
              disabled={status === "added" || status === "exists"}
              onClick={() => add(playlist.id)}
            >
              <span className={styles.name}>{playlist.name}</span>
              {status && status !== "pending" && (
                <span className={styles.status}>{STATUS_LABELS[status]}</span>
              )}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function NewPlaylistForm({ mbid }: { mbid: string }) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const createPlaylist = useCreatePlaylist();
  const addSong = useAddSong();
  const error = createPlaylist.error ?? addSong.error;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const playlist = await createPlaylist.mutateAsync({ name, description: null, is_public: true });
      await addSong.mutateAsync({ playlistId: playlist.id, mbid });
      setCreated(playlist.name);
      setName("");
    } catch {
      // the failed mutation renders its own error below
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label="New playlist"
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        error={error ? errorMessage(error) : undefined}
      />
      <Button
        type="submit"
        variant="primary"
        loading={createPlaylist.isPending || addSong.isPending}
        disabled={!name.trim()}
      >
        Create and add
      </Button>
      {created && (
        <p role="status" className={styles.note}>
          Added to {created}
        </p>
      )}
    </form>
  );
}
```

`web/src/features/playlists/AddToPlaylistButton.module.css`:

```css
.root {
  position: relative;
  display: inline-block;
}

.panel {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 18rem;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-overlay);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 16rem;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.choice {
  width: 100%;
}

/* spreads the playlist name and its status across the full row */
.choice > span:first-child {
  flex: 1;
  justify-content: space-between;
  min-width: 0;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.status {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  line-height: var(--leading-xs);
}

.note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

/* on phones the panel becomes a bottom sheet so it never runs off screen */
@media (max-width: 640px) {
  .panel {
    position: fixed;
    top: auto;
    right: var(--space-4);
    bottom: var(--space-4);
    left: var(--space-4);
    width: auto;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/playlists/AddToPlaylistButton.test.tsx`
Expected: 6 passed

- [ ] **Step 6: Lint, commit, and open the early pull request**

```bash
npm run lint
git add web/
git commit -m "feat(web): add playlist hooks and add to playlist button"
git push -u origin slice/08-playlists
gh pr create --base main --title "Playlists API and AddToPlaylistButton" --body "Tasks 1 to 3 of slice 08, unblocks slice 06 pages"
```

### Task 4: Playlist pages

**Files:**
- Create: `web/src/features/playlists/PlaylistForm.tsx`, `PlaylistForm.module.css`
- Create: `web/src/features/playlists/UserPlaylistsPage.tsx`, `UserPlaylistsPage.module.css`
- Create: `web/src/features/playlists/PlaylistPage.tsx`, `PlaylistPage.module.css`
- Modify: `web/src/features/playlists/routes.ts`
- Test: `web/src/features/playlists/pages.test.tsx`

**Interfaces:**
- Consumes: Task 3 hooks, `useMe`, `Button`, `buttonClassName`, `Card`, `ErrorNotice`, `Notice`, `PageHeader`, `Skeleton`, `TextField`, `TextArea`, `formatDuration`, `pluralize`, `errorMessage`, `renderAt`, `mockFetch`
- Produces: routes `/users/:username/playlists` and `/playlists/:id` in `playlistsRoutes`, and `PlaylistForm({initial?, submitLabel, pending, error, onSubmit, onCancel?})`

Owners get edit, delete with an inline confirmation, and per song Up, Down, and Remove controls. Up and Down send the full new order through the reorder route. Each control's accessible name includes the song title so screen reader users know which row it acts on.

- [ ] **Step 1: Write the failing tests**

`web/src/features/playlists/pages.test.tsx`:

```tsx
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Playlist, PlaylistDetail, SongSummary } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";
import type { PlaylistFields } from "./api";

const ALICE = { id: 1, username: "alice", email: "alice@example.com" };
const ME_ALICE = { "GET /api/auth/me": { body: { user: ALICE } } };
const ME_NOBODY = { "GET /api/auth/me": { body: { user: null } } };

function song(mbid: string, title: string): SongSummary {
  return {
    mbid,
    title,
    disambiguation: null,
    length_ms: 284400,
    artist: { mbid: "r1", name: "Radiohead" },
  };
}

const AIRBAG = song("a1", "Airbag");
const LUCKY = song("b2", "Lucky");

function summary(id: number, name: string, overrides: Partial<Playlist> = {}): Playlist {
  return {
    id,
    name,
    description: null,
    is_public: true,
    owner: { username: "alice" },
    song_count: 0,
    updated_at: "2026-10-02T18:30:00+00:00",
    ...overrides,
  };
}

function detail(songs: SongSummary[], overrides: Partial<Playlist> = {}): PlaylistDetail {
  return { ...summary(1, "Late nights", overrides), song_count: songs.length, songs };
}

function songTitles() {
  const list = screen.getByRole("list", { name: "Songs" });
  return within(list)
    .getAllByRole("listitem")
    .map((item) => within(item).getAllByRole("link")[0].textContent);
}

describe("user playlists page", () => {
  it("shows the owner's playlists and creates a new one", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/users/alice/playlists": {
        body: {
          items: [
            summary(1, "Late nights", { song_count: 2 }),
            summary(2, "Drafts", { is_public: false }),
          ],
        },
      },
      "POST /api/playlists": (body) => ({
        status: 201,
        body: summary(3, (body as PlaylistFields).name),
      }),
      "GET /api/playlists/3": { body: { ...detail([]), id: 3, name: "Road trip" } },
    });
    renderAt("/users/alice/playlists");

    expect(await screen.findByRole("link", { name: "Late nights" })).toBeInTheDocument();
    expect(screen.getByText("2 songs")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Name"), "Road trip");
    await userEvent.click(screen.getByRole("button", { name: "Create playlist" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Road trip" })).toBeInTheDocument();
  });

  it("shows visitors an empty state and no create form", async () => {
    mockFetch({ ...ME_NOBODY, "GET /api/users/bob/playlists": { body: { items: [] } } });
    renderAt("/users/bob/playlists");

    expect(await screen.findByText("bob has no public playlists")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });
});

describe("playlist page", () => {
  it("moves a song up for the owner", async () => {
    const fetchMock = mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG, LUCKY]) },
      "PUT /api/playlists/1/songs": { body: detail([LUCKY, AIRBAG]) },
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Move Lucky up" }));

    await waitFor(() => expect(songTitles()).toEqual(["Lucky", "Airbag"]));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ mbids: ["b2", "a1"] });
  });

  it("removes a song for the owner", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG, LUCKY]) },
      "DELETE /api/playlists/1/songs/a1": { body: detail([LUCKY]) },
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Remove Airbag" }));

    await waitFor(() => expect(songTitles()).toEqual(["Lucky"]));
  });

  it("edits the playlist details", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG]) },
      "PATCH /api/playlists/1": (body) => ({
        body: summary(1, (body as PlaylistFields).name, { song_count: 1 }),
      }),
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Night drive");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Night drive" }),
    ).toBeInTheDocument();
  });

  it("deletes after an inline confirmation", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG]) },
      "DELETE /api/playlists/1": { status: 204 },
      "GET /api/users/alice/playlists": { body: { items: [] } },
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Delete playlist" }));
    expect(screen.getByText("Delete playlist?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "alice's playlists" }),
    ).toBeInTheDocument();
  });

  it("shows visitors the songs without owner controls", async () => {
    mockFetch({ ...ME_NOBODY, "GET /api/playlists/1": { body: detail([AIRBAG]) } });
    renderAt("/playlists/1");

    expect(await screen.findByRole("link", { name: "Airbag" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move Airbag/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/playlists/pages.test.tsx`
Expected: FAIL. Each test times out waiting for its content because both paths still render "Page not found".

- [ ] **Step 3: Write the shared form**

`web/src/features/playlists/PlaylistForm.tsx`:

```tsx
import { type FormEvent, useState } from "react";
import { errorMessage } from "../../api/client";
import { Button, TextArea, TextField } from "../../ui";
import type { PlaylistFields } from "./api";
import styles from "./PlaylistForm.module.css";

const EMPTY: PlaylistFields = { name: "", description: null, is_public: true };

interface PlaylistFormProps {
  initial?: PlaylistFields;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (fields: PlaylistFields) => void;
  onCancel?: () => void;
}

export function PlaylistForm({
  initial = EMPTY,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: PlaylistFormProps) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [isPublic, setIsPublic] = useState(initial.is_public);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ name, description: description || null, is_public: isPublic });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label="Name"
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
      />
      <TextArea
        label="Description"
        value={description}
        maxLength={500}
        onChange={(event) => setDescription(event.target.value)}
      />
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
        />
        Public, anyone can see this playlist
      </label>
      {error ? (
        <p role="alert" className={styles.error}>
          {errorMessage(error)}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button type="submit" variant="primary" loading={pending} disabled={!name.trim()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
```

`web/src/features/playlists/PlaylistForm.module.css`:

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
  cursor: pointer;
}

.checkbox input {
  width: var(--space-4);
  height: var(--space-4);
  accent-color: var(--color-accent);
}

.error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
```

- [ ] **Step 4: Write the user playlists page**

`web/src/features/playlists/UserPlaylistsPage.tsx`:

```tsx
import { Link, useNavigate, useParams } from "react-router";
import type { Playlist } from "../../api/types";
import { Card, ErrorNotice, Notice, PageHeader, pluralize, Skeleton } from "../../ui";
import { useMe } from "../auth/useMe";
import { useCreatePlaylist, useUserPlaylists } from "./api";
import { PlaylistForm } from "./PlaylistForm";
import styles from "./UserPlaylistsPage.module.css";

export function UserPlaylistsPage() {
  const { username = "" } = useParams();
  const { user } = useMe();
  const isOwner = user?.username === username;

  return (
    <>
      <PageHeader eyebrow="Playlists" title={`${username}'s playlists`} />
      <div className={styles.page}>
        {isOwner && <CreatePlaylistCard />}
        <PlaylistGrid username={username} isOwner={isOwner} />
      </div>
    </>
  );
}

function CreatePlaylistCard() {
  const navigate = useNavigate();
  const createPlaylist = useCreatePlaylist();

  return (
    <Card className={styles.create}>
      <h2 className={styles.cardTitle}>New playlist</h2>
      <PlaylistForm
        submitLabel="Create playlist"
        pending={createPlaylist.isPending}
        error={createPlaylist.error}
        onSubmit={(fields) =>
          createPlaylist.mutate(fields, {
            onSuccess: (playlist) => navigate(`/playlists/${playlist.id}`),
          })
        }
      />
    </Card>
  );
}

function PlaylistGrid({ username, isOwner }: { username: string; isOwner: boolean }) {
  const playlists = useUserPlaylists(username);

  if (playlists.isPending) {
    return (
      <div className={styles.grid} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Card key={i} className={styles.card}>
            <Skeleton width="60%" height="var(--leading-lg)" />
            <Skeleton width="30%" height="var(--leading-sm)" />
          </Card>
        ))}
      </div>
    );
  }
  if (playlists.isError) {
    return <ErrorNotice error={playlists.error} onRetry={() => playlists.refetch()} />;
  }
  if (playlists.data.length === 0) {
    return isOwner ? (
      <Notice title="No playlists yet">
        Name your first playlist above, then add songs from any song, album, or artist page.
      </Notice>
    ) : (
      <Notice title={`${username} has no public playlists`} />
    );
  }
  return (
    <ul className={styles.grid}>
      {playlists.data.map((playlist) => (
        <li key={playlist.id}>
          <PlaylistCard playlist={playlist} />
        </li>
      ))}
    </ul>
  );
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Card className={styles.card}>
      <h2 className={styles.cardTitle}>
        <Link to={`/playlists/${playlist.id}`}>{playlist.name}</Link>
      </h2>
      <p className={styles.meta}>
        {pluralize(playlist.song_count, "song")}
        {!playlist.is_public && <span className={styles.badge}>Private</span>}
      </p>
      {playlist.description && <p className={styles.description}>{playlist.description}</p>}
    </Card>
  );
}
```

`web/src/features/playlists/UserPlaylistsPage.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.create {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 32rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--space-4);
  padding: 0;
  list-style: none;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 100%;
}

.cardTitle {
  font-size: var(--text-lg);
  line-height: var(--leading-lg);
}

.meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

.badge {
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--text-xs);
  line-height: var(--leading-xs);
}

.description {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
```

- [ ] **Step 5: Write the playlist page**

`web/src/features/playlists/PlaylistPage.tsx`:

```tsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { errorMessage } from "../../api/client";
import type { PlaylistDetail } from "../../api/types";
import {
  Button,
  buttonClassName,
  Card,
  ErrorNotice,
  formatDuration,
  Notice,
  PageHeader,
  pluralize,
  Skeleton,
} from "../../ui";
import { useMe } from "../auth/useMe";
import { useDeletePlaylist, usePlaylist, useRemoveSong, useReorderSongs, useUpdatePlaylist } from "./api";
import { PlaylistForm } from "./PlaylistForm";
import styles from "./PlaylistPage.module.css";

type Mode = "view" | "edit" | "confirm-delete";

export function PlaylistPage() {
  const id = Number(useParams().id);
  const playlist = usePlaylist(id);
  const { user } = useMe();
  const [mode, setMode] = useState<Mode>("view");

  if (playlist.isPending) return <PlaylistSkeleton />;
  if (playlist.isError) {
    return <ErrorNotice error={playlist.error} onRetry={() => playlist.refetch()} />;
  }

  const detail = playlist.data;
  const owner = detail.owner.username;
  const isOwner = user?.username === owner;

  return (
    <>
      <PageHeader
        eyebrow={detail.is_public ? "Playlist" : "Private playlist"}
        title={detail.name}
        meta={
          <>
            By <Link to={`/users/${owner}/playlists`}>{owner}</Link>,{" "}
            {pluralize(detail.song_count, "song")}
          </>
        }
        actions={
          isOwner && (
            <>
              <Button onClick={() => setMode("edit")}>Edit details</Button>
              <Button variant="ghost" onClick={() => setMode("confirm-delete")}>
                Delete playlist
              </Button>
            </>
          )
        }
      />
      {detail.description && <p className={styles.description}>{detail.description}</p>}
      {isOwner && mode === "edit" && (
        <EditPlaylist detail={detail} onDone={() => setMode("view")} />
      )}
      {isOwner && mode === "confirm-delete" && (
        <DeleteConfirm detail={detail} onCancel={() => setMode("view")} />
      )}
      <SongList detail={detail} isOwner={isOwner} />
    </>
  );
}

function EditPlaylist({ detail, onDone }: { detail: PlaylistDetail; onDone: () => void }) {
  const update = useUpdatePlaylist(detail.id);

  return (
    <Card className={styles.panel}>
      <PlaylistForm
        initial={{ name: detail.name, description: detail.description, is_public: detail.is_public }}
        submitLabel="Save changes"
        pending={update.isPending}
        error={update.error}
        onSubmit={(fields) => update.mutate(fields, { onSuccess: onDone })}
        onCancel={onDone}
      />
    </Card>
  );
}

function DeleteConfirm({ detail, onCancel }: { detail: PlaylistDetail; onCancel: () => void }) {
  const navigate = useNavigate();
  const remove = useDeletePlaylist(detail.id);
  const ownerPage = `/users/${detail.owner.username}/playlists`;

  return (
    <Card className={styles.panel}>
      <p className={styles.confirmTitle}>Delete playlist?</p>
      <p className={styles.muted}>This can't be undone. The songs stay in the catalog.</p>
      {remove.isError && (
        <p role="alert" className={styles.error}>
          {errorMessage(remove.error)}
        </p>
      )}
      <div className={styles.confirmActions}>
        <Button
          className={styles.danger}
          loading={remove.isPending}
          onClick={() => remove.mutate(undefined, { onSuccess: () => navigate(ownerPage) })}
        >
          Delete
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function SongList({ detail, isOwner }: { detail: PlaylistDetail; isOwner: boolean }) {
  const reorder = useReorderSongs(detail.id);
  const removeSong = useRemoveSong(detail.id);

  if (detail.songs.length === 0) {
    return isOwner ? (
      <Notice
        title="No songs yet"
        action={
          <Link to="/search" className={buttonClassName("primary")}>
            Find songs
          </Link>
        }
      >
        Use Add to playlist on any song to build this list.
      </Notice>
    ) : (
      <Notice title="This playlist is empty" />
    );
  }

  const mbids = detail.songs.map((song) => song.mbid);
  const move = (index: number, offset: -1 | 1) => {
    const next = [...mbids];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    reorder.mutate(next);
  };
  const failure = reorder.error ?? removeSong.error;

  return (
    <>
      {failure && <ErrorNotice error={failure} />}
      <ol aria-label="Songs" className={styles.songs}>
        {detail.songs.map((song, index) => (
          <li key={song.mbid} className={styles.song}>
            <span className={styles.position}>{index + 1}</span>
            <div className={styles.titles}>
              <Link to={`/songs/${song.mbid}`} className={styles.title}>
                {song.title}
              </Link>
              <Link to={`/artists/${song.artist.mbid}`} className={styles.artist}>
                {song.artist.name}
              </Link>
            </div>
            <span className={styles.duration}>
              {song.length_ms === null ? "" : formatDuration(song.length_ms)}
            </span>
            {isOwner && (
              <div className={styles.controls}>
                <Button
                  variant="ghost"
                  aria-label={`Move ${song.title} up`}
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(index, -1)}
                >
                  Up
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Move ${song.title} down`}
                  disabled={index === mbids.length - 1 || reorder.isPending}
                  onClick={() => move(index, 1)}
                >
                  Down
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Remove ${song.title}`}
                  loading={removeSong.isPending && removeSong.variables === song.mbid}
                  onClick={() => removeSong.mutate(song.mbid)}
                >
                  Remove
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

function PlaylistSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <Skeleton width="40%" height="var(--leading-3xl)" />
      <Skeleton width="20%" height="var(--leading-sm)" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height="var(--space-12)" />
      ))}
    </div>
  );
}
```

`web/src/features/playlists/PlaylistPage.module.css`:

```css
.description {
  max-width: 40rem;
  margin-bottom: var(--space-8);
  color: var(--color-text-muted);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 32rem;
  margin-bottom: var(--space-8);
}

.confirmTitle {
  font-weight: 600;
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

.confirmActions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-1);
}

/* doubled class outranks the secondary variant hover rule */
.danger.danger,
.danger.danger:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.songs {
  padding: 0;
  border-top: 1px solid var(--color-border);
  list-style: none;
}

.song {
  display: grid;
  grid-template-columns: var(--space-8) minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.position,
.duration {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-sm);
}

.titles {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.title {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

.controls {
  display: flex;
  gap: var(--space-1);
}

.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* owner controls wrap under the title on phones */
@media (max-width: 640px) {
  .song {
    grid-template-columns: var(--space-8) minmax(0, 1fr) auto;
  }

  .controls {
    grid-column: 2 / -1;
  }
}
```

- [ ] **Step 6: Register the routes**

Replace `web/src/features/playlists/routes.ts`:

```ts
import type { RouteObject } from "react-router";
import { PlaylistPage } from "./PlaylistPage";
import { UserPlaylistsPage } from "./UserPlaylistsPage";

export const playlistsRoutes: RouteObject[] = [
  { path: "/users/:username/playlists", Component: UserPlaylistsPage },
  { path: "/playlists/:id", Component: PlaylistPage },
];
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/features/playlists`
Expected: 13 passed

- [ ] **Step 8: Run every check and look at it**

```bash
npm test
npm run lint
npm run build
```

Expected: all pass. Then with Flask and Vite running, log in, open `/users/<you>/playlists`, create a playlist, add two songs from a song page, move one up, remove one, edit the name, and delete it through the inline confirmation. At 375px wide the add popover opens as a bottom sheet, and the Up, Down, and Remove controls wrap under each title without horizontal scrolling.

- [ ] **Step 9: Commit, push, and open the pull request**

```bash
git add web/
git commit -m "feat(web): add playlist pages with edit, delete, and reorder"
git push
gh pr create --base main --title "Playlist pages" --body "Task 4 of slice 08"
```
