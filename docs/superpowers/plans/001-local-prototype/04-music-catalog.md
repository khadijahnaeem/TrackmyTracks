# Slice 04 Music Catalog Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One client for MusicBrainz and ListenBrainz plus a service that caches artists, albums, and songs into Postgres on first touch.

**Architecture:** `app/musicbrainz.py` is the only module that talks to external services. It turns JSON into small frozen dataclasses and keeps MusicBrainz requests a second apart. `app/catalog/service.py` upserts those dataclasses by MBID with `INSERT ... ON CONFLICT`, so concurrent first visits never collide. Tests replace the client with `FakeMusicBrainz`, which runs the real parsing over recorded fixtures.

**Tech Stack:** requests, responses, SQLAlchemy Postgres dialect inserts

**Spec:** `docs/superpowers/specs/001-local-prototype-design.md`

**Index:** `docs/superpowers/plans/001-local-prototype.md`. Its Global Constraints and Contracts apply to every task here.

**Branch:** `slice/04-music-catalog`. Task 1 needs nothing. Tasks 2 and 3 need slice 02 Task 1 merged. Tasks 4 and 5 need slice 02 merged.

---

## External API reference

| Need | Request | Used fields |
|---|---|---|
| Artist | `GET musicbrainz.org/ws/2/artist/<mbid>?fmt=json` | `id`, `name` |
| Discography | `GET /ws/2/release-group?artist=<mbid>&type=album&inc=artist-credits&limit=100` | `release-groups[].id, title, first-release-date, secondary-types, artist-credit` |
| Album | `GET /ws/2/release-group/<mbid>?inc=artist-credits+releases` | `releases[].id, status, date` |
| Tracklist | `GET /ws/2/release/<mbid>?inc=recordings+artist-credits` | `media[].tracks[].recording` |
| Song | `GET /ws/2/recording/<mbid>?inc=artist-credits` | `id, title, disambiguation, length, artist-credit` |
| Search | `GET /ws/2/{artist,release-group,recording}?query=&limit=25&offset=` | `count` and the plural list |
| Top songs | `GET api.listenbrainz.org/1/popularity/top-recordings-for-artist/<mbid>` | `recording_mbid, recording_name, length` |

MusicBrainz answers 400 for a malformed MBID, 404 for an unknown one, and 503 when rate limited. A lookup of a merged MBID answers with the surviving entity and its new `id`.

---

### Task 1: Recorded fixtures

**Files:**
- Create: `api/tests/fixtures/musicbrainz/*.json`, nine files below

**Interfaces:**
- Consumes: nothing
- Produces: fixture files named `artist`, `artist-albums`, `release-group`, `release`, `recording`, `search-artists`, `search-albums`, `search-songs`, `top-recordings`

These were recorded from the live APIs on 2026-10-02 and trimmed to the fields the client reads. `release-group.json` was hand edited to hold one bootleg dated before the official releases, so the earliest official rule is exercised.

- [ ] **Step 1: Branch and write the fixtures**

```bash
git checkout main && git pull
git checkout -b slice/04-music-catalog
```

`api/tests/fixtures/musicbrainz/artist.json`:

```json
{
  "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
  "name": "Radiohead"
}
```

`api/tests/fixtures/musicbrainz/artist-albums.json`:

```json
{
  "release-group-count": 3,
  "release-groups": [
    {
      "id": "5c14fd50-a2f1-3672-9537-b0dad91bea2f",
      "title": "Hail to the Thief",
      "primary-type": "Album",
      "secondary-types": [],
      "first-release-date": "2003-05-26",
      "artist-credit": [
        {
          "name": "Radiohead",
          "joinphrase": "",
          "artist": {
            "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
            "name": "Radiohead"
          }
        }
      ]
    },
    {
      "id": "6e335887-60ba-38f0-95af-fae7774336bf",
      "title": "In Rainbows",
      "primary-type": "Album",
      "secondary-types": [],
      "first-release-date": "2007-10-10",
      "artist-credit": [
        {
          "name": "Radiohead",
          "joinphrase": "",
          "artist": {
            "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
            "name": "Radiohead"
          }
        }
      ]
    },
    {
      "id": "01618034-2de5-4ace-a057-fcd0bca4cf08",
      "title": "1995‐06‐10: Cabaret Metro, Chicago, IL, USA",
      "primary-type": "Album",
      "secondary-types": [
        "Live"
      ],
      "first-release-date": "1995-06-10",
      "artist-credit": [
        {
          "name": "Radiohead",
          "joinphrase": "",
          "artist": {
            "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
            "name": "Radiohead"
          }
        }
      ]
    }
  ]
}
```

`api/tests/fixtures/musicbrainz/release-group.json`:

```json
{
  "id": "b1392450-e666-3926-a536-22c65f834433",
  "title": "OK Computer",
  "primary-type": "Album",
  "secondary-types": [],
  "first-release-date": "1997-05-21",
  "artist-credit": [
    {
      "name": "Radiohead",
      "joinphrase": "",
      "artist": {
        "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
        "name": "Radiohead"
      }
    }
  ],
  "releases": [
    {
      "id": "5c4b0a9e-2d1f-4c8e-9b7a-1f2e3d4c5b6a",
      "title": "OK Computer",
      "status": "Bootleg",
      "date": "1996-12-01"
    },
    {
      "id": "1834eae1-741b-3c03-9ca5-0df3decb43ea",
      "title": "OK Computer",
      "status": "Official",
      "date": "1997-05-21"
    },
    {
      "id": "e16cda60-6e6d-4a32-8d7c-e12d9aeb72de",
      "title": "OK Computer",
      "status": "Official",
      "date": "1997-06-16"
    }
  ]
}
```

`api/tests/fixtures/musicbrainz/release.json`:

```json
{
  "id": "1834eae1-741b-3c03-9ca5-0df3decb43ea",
  "title": "OK Computer",
  "media": [
    {
      "position": 1,
      "tracks": [
        {
          "id": "ff7733a6-6903-3e2e-b683-6dbbb0f59ec6",
          "position": 1,
          "title": "Airbag",
          "recording": {
            "id": "4a7fea2e-545b-4c63-bc9a-9943cc3a29d7",
            "title": "Airbag",
            "disambiguation": "",
            "length": 284400,
            "artist-credit": [
              {
                "name": "Radiohead",
                "joinphrase": "",
                "artist": {
                  "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
                  "name": "Radiohead"
                }
              }
            ]
          }
        },
        {
          "id": "6a7cd9af-f665-3652-9aba-1e89a4236e9f",
          "position": 2,
          "title": "Paranoid Android",
          "recording": {
            "id": "9f9cf187-d6f9-437f-9d98-d59cdbd52757",
            "title": "Paranoid Android",
            "disambiguation": "",
            "length": 384000,
            "artist-credit": [
              {
                "name": "Radiohead",
                "joinphrase": "",
                "artist": {
                  "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
                  "name": "Radiohead"
                }
              }
            ]
          }
        },
        {
          "id": "692f228b-b908-3cc9-85e6-17ab3e518d39",
          "position": 3,
          "title": "Subterranean Homesick Alien",
          "recording": {
            "id": "bd82738d-163c-4b1a-bfaf-7acffe30e68a",
            "title": "Subterranean Homesick Alien",
            "disambiguation": "",
            "length": 267706,
            "artist-credit": [
              {
                "name": "Radiohead",
                "joinphrase": "",
                "artist": {
                  "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
                  "name": "Radiohead"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

`api/tests/fixtures/musicbrainz/recording.json`:

```json
{
  "id": "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3",
  "title": "Karma Police",
  "disambiguation": "",
  "length": 262426,
  "artist-credit": [
    {
      "name": "Radiohead",
      "joinphrase": "",
      "artist": {
        "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
        "name": "Radiohead"
      }
    }
  ]
}
```

`api/tests/fixtures/musicbrainz/search-artists.json`:

```json
{
  "count": 29,
  "offset": 0,
  "artists": [
    {
      "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
      "name": "Radiohead"
    },
    {
      "id": "c74f4726-2671-4011-81b6-f70da905c05a",
      "name": "On a Friday"
    }
  ]
}
```

`api/tests/fixtures/musicbrainz/search-albums.json`:

```json
{
  "count": 912,
  "offset": 0,
  "release-groups": [
    {
      "id": "b1392450-e666-3926-a536-22c65f834433",
      "title": "OK Computer",
      "primary-type": "Album",
      "secondary-types": [],
      "first-release-date": "1997-05-21",
      "artist-credit": [
        {
          "name": "Radiohead",
          "joinphrase": "",
          "artist": {
            "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
            "name": "Radiohead"
          }
        }
      ]
    },
    {
      "id": "3b55129d-276c-4c42-8327-e47ba94f2ddf",
      "title": "OK Computer (8-bit)",
      "primary-type": "Album",
      "secondary-types": [
        "Remix"
      ],
      "first-release-date": "2012-04-11",
      "artist-credit": [
        {
          "name": "Quinton Sung",
          "joinphrase": "",
          "artist": {
            "id": "318d1a3b-7323-4b59-8e7f-e16ddf8acacc",
            "name": "Quinton Sung"
          }
        }
      ]
    }
  ]
}
```

`api/tests/fixtures/musicbrainz/search-songs.json`:

```json
{
  "count": 34017,
  "offset": 0,
  "recordings": [
    {
      "id": "7e2c01ee-4ab2-41c7-9b4a-57f712053183",
      "title": "Karma Police",
      "disambiguation": "live, 2003‐06‐04: Electric Lady Studios, New York City, NY, USA",
      "length": null,
      "artist-credit": [
        {
          "name": "Radiohead",
          "joinphrase": "",
          "artist": {
            "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
            "name": "Radiohead"
          }
        }
      ]
    },
    {
      "id": "6a29ed9f-b78c-4281-902a-8ff78af43f67",
      "title": "Karma Police",
      "disambiguation": "live, 1997-12-19: Hammerstein Ballroom, New York City, NY, USA",
      "length": 253720,
      "artist-credit": [
        {
          "name": "Radiohead",
          "joinphrase": "",
          "artist": {
            "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
            "name": "Radiohead"
          }
        }
      ]
    }
  ]
}
```

`api/tests/fixtures/musicbrainz/top-recordings.json`:

```json
[
  {
    "artist_mbids": [
      "a74b1b7f-71a5-4011-9441-d0b5e4122711"
    ],
    "artist_name": "Radiohead",
    "recording_mbid": "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3",
    "recording_name": "Karma Police",
    "length": 262426,
    "total_listen_count": 3890683
  },
  {
    "artist_mbids": [
      "a74b1b7f-71a5-4011-9441-d0b5e4122711"
    ],
    "artist_name": "Radiohead",
    "recording_mbid": "9f9cf187-d6f9-437f-9d98-d59cdbd52757",
    "recording_name": "Paranoid Android",
    "length": 384000,
    "total_listen_count": 3092016
  },
  {
    "artist_mbids": [
      "a74b1b7f-71a5-4011-9441-d0b5e4122711"
    ],
    "artist_name": "Radiohead",
    "recording_mbid": "980a426e-623e-4ea5-98c7-008d037a0508",
    "recording_name": "No Surprises",
    "length": 228533,
    "total_listen_count": 3001215
  },
  {
    "artist_mbids": [
      "a74b1b7f-71a5-4011-9441-d0b5e4122711"
    ],
    "artist_name": "Radiohead",
    "recording_mbid": "72c6b4d3-71a8-4c70-bf50-da11c0149089",
    "recording_name": "All I Need",
    "length": 228746,
    "total_listen_count": 2843571
  },
  {
    "artist_mbids": [
      "a74b1b7f-71a5-4011-9441-d0b5e4122711"
    ],
    "artist_name": "Radiohead",
    "recording_mbid": "70595637-9310-45f2-a266-58f8de4874a7",
    "recording_name": "Creep",
    "length": 236666,
    "total_listen_count": 2829991
  },
  {
    "artist_mbids": [
      "a74b1b7f-71a5-4011-9441-d0b5e4122711"
    ],
    "artist_name": "Radiohead",
    "recording_mbid": "faea2aa0-80a9-41be-9b1e-3b994f4f76ac",
    "recording_name": "15 Step",
    "length": 238000,
    "total_listen_count": 2801152
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add api/tests/fixtures
git commit -m "test(api): add recorded musicbrainz and listenbrainz fixtures"
```

### Task 2: Client lookups, throttle, and error mapping

**Files:**
- Create: `api/app/musicbrainz.py`
- Create: `api/tests/fakes.py`
- Test: `api/tests/test_musicbrainz.py`

**Interfaces:**
- Consumes: `CatalogUnavailable`, `NotFound` from slice 02
- Produces:
  - Dataclasses `ArtistData(mbid, name)`, `AlbumData(mbid, title, release_year, artist)`, `SongData(mbid, title, disambiguation, length_ms, artist)`, `AlbumDetail(album, tracks)`, `SearchResults[T](items, total)`
  - `MusicBrainzClient(user_agent, listenbrainz_token)` with `get_artist(mbid) -> ArtistData`, `get_artist_albums(mbid) -> list[AlbumData]` (studio albums newest first), `get_album(mbid) -> AlbumDetail`, `get_song(mbid) -> SongData`, `top_songs(artist: ArtistData, limit=5) -> list[SongData]`
  - `musicbrainz() -> MusicBrainzClient` reading `current_app.extensions["musicbrainz"]`
  - `tests/fakes.py` with `load_fixture(name)` and the MBID constants from the index

- [ ] **Step 1: Write the fixture loader and failing tests**

`api/tests/fakes.py`:

```python
import json
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures" / "musicbrainz"

RADIOHEAD = "a74b1b7f-71a5-4011-9441-d0b5e4122711"
OK_COMPUTER = "b1392450-e666-3926-a536-22c65f834433"
OK_COMPUTER_RELEASE = "1834eae1-741b-3c03-9ca5-0df3decb43ea"
AIRBAG = "4a7fea2e-545b-4c63-bc9a-9943cc3a29d7"
PARANOID_ANDROID = "9f9cf187-d6f9-437f-9d98-d59cdbd52757"
KARMA_POLICE = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3"


def load_fixture(name: str):
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))
```

`api/tests/test_musicbrainz.py`:

```python
import pytest
import requests
import responses

from app.errors import CatalogUnavailable, NotFound
from app.musicbrainz import LB_ROOT, MB_ROOT, ArtistData, MusicBrainzClient
from tests.fakes import (
    KARMA_POLICE,
    OK_COMPUTER,
    OK_COMPUTER_RELEASE,
    RADIOHEAD,
    load_fixture,
)

RADIOHEAD_DATA = ArtistData(RADIOHEAD, "Radiohead")


@pytest.fixture
def mb(monkeypatch):
    monkeypatch.setattr("app.musicbrainz.time.sleep", lambda seconds: None)
    return MusicBrainzClient("TrackmyTracks/test ( tests )")


@pytest.fixture
def api():
    with responses.RequestsMock() as mock:
        yield mock


def test_get_artist_sends_user_agent(mb, api):
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", json=load_fixture("artist"))

    assert mb.get_artist(RADIOHEAD) == RADIOHEAD_DATA
    assert api.calls[0].request.headers["User-Agent"] == "TrackmyTracks/test ( tests )"


def test_artist_albums_skip_live_and_sort_newest_first(mb, api):
    api.get(f"{MB_ROOT}/release-group", json=load_fixture("artist-albums"))

    albums = mb.get_artist_albums(RADIOHEAD)

    assert [(a.title, a.release_year) for a in albums] == [
        ("In Rainbows", 2007),
        ("Hail to the Thief", 2003),
    ]


def test_album_uses_earliest_official_release(mb, api):
    api.get(f"{MB_ROOT}/release-group/{OK_COMPUTER}", json=load_fixture("release-group"))
    api.get(f"{MB_ROOT}/release/{OK_COMPUTER_RELEASE}", json=load_fixture("release"))

    detail = mb.get_album(OK_COMPUTER)

    assert (detail.album.title, detail.album.release_year) == ("OK Computer", 1997)
    assert detail.album.artist == RADIOHEAD_DATA
    assert [song.title for song in detail.tracks] == [
        "Airbag",
        "Paranoid Android",
        "Subterranean Homesick Alien",
    ]
    assert detail.tracks[0].length_ms == 284400


def test_get_song_maps_blank_disambiguation_to_none(mb, api):
    api.get(f"{MB_ROOT}/recording/{KARMA_POLICE}", json=load_fixture("recording"))

    song = mb.get_song(KARMA_POLICE)

    assert (song.title, song.disambiguation, song.length_ms) == ("Karma Police", None, 262426)
    assert song.artist == RADIOHEAD_DATA


def test_top_songs_keeps_first_five_for_the_artist(mb, api):
    url = f"{LB_ROOT}/popularity/top-recordings-for-artist/{RADIOHEAD}"
    api.get(url, json=load_fixture("top-recordings"))

    songs = mb.top_songs(RADIOHEAD_DATA)

    assert [song.title for song in songs] == [
        "Karma Police",
        "Paranoid Android",
        "No Surprises",
        "All I Need",
        "Creep",
    ]
    assert {song.artist for song in songs} == {RADIOHEAD_DATA}


def test_top_songs_is_empty_without_listening_data(mb, api):
    api.get(f"{LB_ROOT}/popularity/top-recordings-for-artist/{RADIOHEAD}", status=404)

    assert mb.top_songs(RADIOHEAD_DATA) == []


def test_requests_are_spaced_one_second_apart(monkeypatch, api):
    sleeps = []
    monkeypatch.setattr("app.musicbrainz.time.sleep", sleeps.append)
    mb = MusicBrainzClient("TrackmyTracks/test")
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", json=load_fixture("artist"))

    mb.get_artist(RADIOHEAD)
    mb.get_artist(RADIOHEAD)

    assert len(sleeps) == 1
    assert 0.9 < sleeps[0] <= 1.0


@pytest.mark.parametrize("status", [400, 404])
def test_bad_or_unknown_mbid_is_not_found(mb, api, status):
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", status=status)

    with pytest.raises(NotFound):
        mb.get_artist(RADIOHEAD)


def test_rate_limit_or_outage_is_unavailable(mb, api):
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", status=503)

    with pytest.raises(CatalogUnavailable):
        mb.get_artist(RADIOHEAD)


def test_network_failure_is_unavailable(mb, api):
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", body=requests.ConnectionError())

    with pytest.raises(CatalogUnavailable):
        mb.get_artist(RADIOHEAD)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_musicbrainz.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.musicbrainz'`

- [ ] **Step 3: Write the implementation**

`api/app/musicbrainz.py`:

```python
import threading
import time
from dataclasses import dataclass

import requests
from flask import current_app

from app.errors import CatalogUnavailable, NotFound

MB_ROOT = "https://musicbrainz.org/ws/2"
LB_ROOT = "https://api.listenbrainz.org/1"
TIMEOUT_SECONDS = 5
MIN_INTERVAL_SECONDS = 1.0
UNAVAILABLE = "Music catalog is unavailable, try again"


@dataclass(frozen=True)
class ArtistData:
    mbid: str
    name: str


@dataclass(frozen=True)
class AlbumData:
    mbid: str
    title: str
    release_year: int | None
    artist: ArtistData


@dataclass(frozen=True)
class SongData:
    mbid: str
    title: str
    disambiguation: str | None
    length_ms: int | None
    artist: ArtistData


@dataclass(frozen=True)
class AlbumDetail:
    album: AlbumData
    tracks: list[SongData]


@dataclass(frozen=True)
class SearchResults[T]:
    items: list[T]
    total: int


def _artist(credit: list[dict]) -> ArtistData:
    artist = credit[0]["artist"]
    return ArtistData(artist["id"], artist["name"])


def _year(date: str | None) -> int | None:
    return int(date[:4]) if date else None


def _album(group: dict) -> AlbumData:
    return AlbumData(
        group["id"],
        group["title"],
        _year(group.get("first-release-date")),
        _artist(group["artist-credit"]),
    )


def _song(recording: dict) -> SongData:
    return SongData(
        recording["id"],
        recording["title"],
        recording.get("disambiguation") or None,
        recording.get("length"),
        _artist(recording["artist-credit"]),
    )


def _earliest_release(releases: list[dict]) -> str:
    # unofficial releases only count when an album has nothing official
    candidates = [r for r in releases if r.get("status") == "Official"] or releases
    return min(candidates, key=lambda r: r.get("date") or "9999")["id"]


class MusicBrainzClient:
    def __init__(self, user_agent: str):
        self._http = requests.Session()
        self._http.headers["User-Agent"] = user_agent
        self._lock = threading.Lock()
        self._next_request_at = 0.0

    def get_artist(self, mbid: str) -> ArtistData:
        data = self._mb(f"/artist/{mbid}")
        return ArtistData(data["id"], data["name"])

    def get_artist_albums(self, mbid: str) -> list[AlbumData]:
        data = self._mb(
            "/release-group", artist=mbid, type="album", inc="artist-credits", limit=100
        )
        # live albums and compilations carry secondary types
        albums = [_album(g) for g in data["release-groups"] if not g["secondary-types"]]
        return sorted(albums, key=lambda album: album.release_year or 0, reverse=True)

    def get_album(self, mbid: str) -> AlbumDetail:
        group = self._mb(f"/release-group/{mbid}", inc="artist-credits releases")
        release_id = _earliest_release(group["releases"])
        release = self._mb(f"/release/{release_id}", inc="recordings artist-credits")
        tracks = [
            _song(track["recording"])
            for medium in release["media"]
            for track in medium.get("tracks", [])
        ]
        return AlbumDetail(_album(group), tracks)

    def get_song(self, mbid: str) -> SongData:
        return _song(self._mb(f"/recording/{mbid}", inc="artist-credits"))

    def top_songs(self, artist: ArtistData, limit: int = 5) -> list[SongData]:
        try:
            data = self._get(f"{LB_ROOT}/popularity/top-recordings-for-artist/{artist.mbid}", {})
        except NotFound:
            # artists nobody has listened to have no popularity data
            return []
        return [
            SongData(row["recording_mbid"], row["recording_name"], None, row.get("length"), artist)
            for row in data[:limit]
        ]

    def _mb(self, path: str, **params) -> dict:
        # musicbrainz allows one request per second per client
        with self._lock:
            wait = self._next_request_at - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            try:
                return self._get(f"{MB_ROOT}{path}", {**params, "fmt": "json"})
            finally:
                self._next_request_at = time.monotonic() + MIN_INTERVAL_SECONDS

    def _get(self, url: str, params: dict):
        try:
            response = self._http.get(url, params=params, timeout=TIMEOUT_SECONDS)
        except requests.RequestException as error:
            raise CatalogUnavailable(UNAVAILABLE) from error
        if response.status_code in (400, 404):
            raise NotFound("Not found in the music catalog")
        if not response.ok:
            raise CatalogUnavailable(UNAVAILABLE)
        return response.json()


def musicbrainz() -> MusicBrainzClient:
    return current_app.extensions["musicbrainz"]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_musicbrainz.py -v`
Expected: 11 passed

- [ ] **Step 5: Lint, format, and commit**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): add musicbrainz and listenbrainz client"
```

### Task 3: Search with safe query text

**Files:**
- Modify: `api/app/musicbrainz.py`
- Test: `api/tests/test_musicbrainz.py`

**Interfaces:**
- Consumes: Task 2
- Produces: `search_artists(query, page) -> SearchResults[ArtistData]`, `search_albums(query, page) -> SearchResults[AlbumData]`, `search_songs(query, page) -> SearchResults[SongData]`, `SEARCH_PAGE_SIZE = 25`

MusicBrainz search takes Lucene syntax, so a user typing `AC/DC` would send a regex and get a 400. Escaping every special character makes user text literal.

- [ ] **Step 1: Write the failing tests**

Add `from responses import matchers` to the imports in `api/tests/test_musicbrainz.py`, then append:

```python
def test_search_songs_pages_and_parses(mb, api):
    api.get(
        f"{MB_ROOT}/recording",
        json=load_fixture("search-songs"),
        match=[
            matchers.query_param_matcher(
                {"query": "karma police", "limit": "25", "offset": "25", "fmt": "json"}
            )
        ],
    )

    results = mb.search_songs("karma police", page=2)

    assert results.total == 34017
    assert results.items[0].disambiguation.startswith("live, 2003")


def test_search_albums_limits_to_albums(mb, api):
    api.get(
        f"{MB_ROOT}/release-group",
        json=load_fixture("search-albums"),
        match=[
            matchers.query_param_matcher(
                {
                    "query": "releasegroup:(ok computer) AND primarytype:album",
                    "limit": "25",
                    "offset": "0",
                    "fmt": "json",
                }
            )
        ],
    )

    results = mb.search_albums("ok computer", page=1)

    assert [album.title for album in results.items] == ["OK Computer", "OK Computer (8-bit)"]


def test_search_escapes_lucene_syntax(mb, api):
    api.get(
        f"{MB_ROOT}/artist",
        json=load_fixture("search-artists"),
        match=[
            matchers.query_param_matcher(
                {"query": 'AC\\/DC \\"live\\"', "limit": "25", "offset": "0", "fmt": "json"}
            )
        ],
    )

    results = mb.search_artists('AC/DC "live"', page=1)

    assert results.items[0].name == "Radiohead"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_musicbrainz.py -v -k search`
Expected: FAIL with `AttributeError: 'MusicBrainzClient' object has no attribute 'search_songs'`

- [ ] **Step 3: Write the implementation**

In `api/app/musicbrainz.py`, add `import re` and `from collections.abc import Callable` to the imports, then these module constants below `UNAVAILABLE`:

```python
SEARCH_PAGE_SIZE = 25
LUCENE_SPECIAL = re.compile(r'([+\-&|!(){}\[\]^"~*?:\\/])')
```

Add this function above `class MusicBrainzClient`:

```python
def _escape(query: str) -> str:
    return LUCENE_SPECIAL.sub(r"\\\1", query)
```

Add these methods to `MusicBrainzClient`, right after `top_songs`:

```python
    def search_artists(self, query: str, page: int) -> SearchResults[ArtistData]:
        return self._search(
            "artist", "artists", _escape(query), page, lambda a: ArtistData(a["id"], a["name"])
        )

    def search_albums(self, query: str, page: int) -> SearchResults[AlbumData]:
        lucene = f"releasegroup:({_escape(query)}) AND primarytype:album"
        return self._search("release-group", "release-groups", lucene, page, _album)

    def search_songs(self, query: str, page: int) -> SearchResults[SongData]:
        return self._search("recording", "recordings", _escape(query), page, _song)

    def _search[T](
        self, entity: str, key: str, query: str, page: int, parse: Callable[[dict], T]
    ) -> SearchResults[T]:
        offset = (page - 1) * SEARCH_PAGE_SIZE
        data = self._mb(f"/{entity}", query=query, limit=SEARCH_PAGE_SIZE, offset=offset)
        return SearchResults([parse(item) for item in data[key]], data["count"])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_musicbrainz.py -v`
Expected: 14 passed

- [ ] **Step 5: Lint, format, and commit**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): add catalog search with escaped query text"
```

### Task 4: Cache on touch service and the test fake

**Files:**
- Create: `api/app/catalog/service.py`
- Modify: `api/tests/fakes.py`, `api/tests/conftest.py`
- Test: `api/tests/test_catalog_service.py`

**Interfaces:**
- Consumes: models, `MODELS`, `Kind`, the client
- Produces:
  - `find_cached(kind, mbid) -> Song | Album | Artist | None`, no network
  - `get_or_cache_song(mbid) -> Song`
  - `get_or_cache_album(mbid) -> Album` with `tracks` cached and `fetched_at` set
  - `get_or_cache_artist(mbid) -> Artist` with `top_songs` and discography albums cached and `fetched_at` set. Discography albums keep `fetched_at` empty until their own page is opened
  - `get_or_cache(kind, mbid)`
  - `FakeMusicBrainz` with `calls: list[str]`, `unavailable: bool`, and a mutable `routes` dict, plus the autouse `fake_mb` fixture

- [ ] **Step 1: Write the fake**

Add these imports to the top of `api/tests/fakes.py`:

```python
from app.errors import CatalogUnavailable, NotFound
from app.musicbrainz import LB_ROOT, MB_ROOT, UNAVAILABLE, MusicBrainzClient
```

Then append:

```python
ROUTES = {
    f"/artist/{RADIOHEAD}": "artist",
    "/release-group?artist": "artist-albums",
    f"/release-group/{OK_COMPUTER}": "release-group",
    f"/release/{OK_COMPUTER_RELEASE}": "release",
    f"/recording/{KARMA_POLICE}": "recording",
    "/artist?query": "search-artists",
    "/release-group?query": "search-albums",
    "/recording?query": "search-songs",
    f"/popularity/top-recordings-for-artist/{RADIOHEAD}": "top-recordings",
}


class FakeMusicBrainz(MusicBrainzClient):
    """Real parsing over recorded fixtures with no network or throttle"""

    def __init__(self):
        super().__init__("TrackmyTracks/test")
        self.calls: list[str] = []
        self.unavailable = False
        self.routes = {path: load_fixture(name) for path, name in ROUTES.items()}

    def _mb(self, path: str, **params) -> dict:
        return self._get(f"{MB_ROOT}{path}", params)

    def _get(self, url: str, params: dict):
        key = url.removeprefix(MB_ROOT).removeprefix(LB_ROOT)
        key += "".join(f"?{name}" for name in ("query", "artist") if name in params)
        self.calls.append(key)
        if self.unavailable:
            raise CatalogUnavailable(UNAVAILABLE)
        if key not in self.routes:
            raise NotFound("Not found in the music catalog")
        return self.routes[key]
```

Add to `api/tests/conftest.py` next to the other fixtures, with `from tests.fakes import FakeMusicBrainz` in the imports:

```python
@pytest.fixture(autouse=True)
def fake_mb(app):
    fake = FakeMusicBrainz()
    app.extensions["musicbrainz"] = fake
    return fake
```

- [ ] **Step 2: Write the failing tests**

`api/tests/test_catalog_service.py`:

```python
import pytest
from sqlalchemy import func, select

from app.catalog.service import (
    find_cached,
    get_or_cache,
    get_or_cache_album,
    get_or_cache_artist,
    get_or_cache_song,
)
from app.errors import CatalogUnavailable, NotFound
from app.extensions import db
from app.models import Album, Artist, Song
from tests.fakes import AIRBAG, KARMA_POLICE, OK_COMPUTER, RADIOHEAD, load_fixture


def _count(model) -> int:
    return db.session.scalar(select(func.count()).select_from(model))


def test_album_caches_tracklist_once(fake_mb):
    album = get_or_cache_album(OK_COMPUTER)

    assert album.fetched_at is not None
    assert [(t.position, t.song.title) for t in album.tracks] == [
        (1, "Airbag"),
        (2, "Paranoid Android"),
        (3, "Subterranean Homesick Alien"),
    ]

    fake_mb.calls.clear()
    assert get_or_cache_album(OK_COMPUTER).id == album.id
    assert fake_mb.calls == []


def test_artist_caches_discography_and_top_songs(fake_mb):
    artist = get_or_cache_artist(RADIOHEAD)

    assert artist.fetched_at is not None
    assert [t.song.title for t in artist.top_songs] == [
        "Karma Police",
        "Paranoid Android",
        "No Surprises",
        "All I Need",
        "Creep",
    ]
    albums = db.session.scalars(select(Album).order_by(Album.release_year.desc())).all()
    assert [(a.title, a.fetched_at) for a in albums] == [
        ("In Rainbows", None),
        ("Hail to the Thief", None),
    ]


def test_song_creates_a_stub_artist_that_fills_in_later(fake_mb):
    song = get_or_cache_song(KARMA_POLICE)

    assert song.title == "Karma Police"
    assert song.artist.fetched_at is None

    assert get_or_cache_artist(RADIOHEAD).fetched_at is not None
    assert _count(Artist) == 1


def test_discography_album_fetches_tracks_when_opened(fake_mb):
    stub = Artist(mbid=RADIOHEAD, name="Radiohead")
    db.session.add(Album(mbid=OK_COMPUTER, title="OK Computer", artist=stub))
    db.session.commit()

    album = get_or_cache_album(OK_COMPUTER)

    assert len(album.tracks) == 3
    assert _count(Album) == 1


def test_existing_song_rows_are_reused_not_duplicated(fake_mb):
    db.session.add(Song(mbid=AIRBAG, title="Airbag", artist=Artist(mbid=RADIOHEAD, name="Radiohead")))
    db.session.commit()

    get_or_cache_album(OK_COMPUTER)

    assert _count(Song) == 3


def test_merged_mbid_returns_the_surviving_entity(fake_mb):
    merged = "00000000-0000-4000-8000-000000000001"
    fake_mb.routes[f"/recording/{merged}"] = load_fixture("recording")

    song = get_or_cache_song(merged)

    assert song.mbid == KARMA_POLICE


def test_unknown_mbid_is_not_found(fake_mb):
    with pytest.raises(NotFound):
        get_or_cache_song("00000000-0000-4000-8000-000000000002")


def test_outage_writes_nothing(fake_mb):
    fake_mb.unavailable = True

    with pytest.raises(CatalogUnavailable):
        get_or_cache_artist(RADIOHEAD)
    assert _count(Artist) == 0


def test_find_cached_never_calls_out(fake_mb):
    assert find_cached("album", OK_COMPUTER) is None
    get_or_cache("album", OK_COMPUTER)
    fake_mb.calls.clear()

    assert find_cached("album", OK_COMPUTER).title == "OK Computer"
    assert fake_mb.calls == []
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_catalog_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.catalog.service'`

- [ ] **Step 4: Write the implementation**

`api/app/catalog/service.py`:

```python
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.extensions import db
from app.kinds import MODELS, Kind
from app.models import Album, AlbumSong, Artist, ArtistTopSong, Song
from app.musicbrainz import AlbumData, ArtistData, SongData, musicbrainz


def find_cached(kind: Kind, mbid: str) -> Song | Album | Artist | None:
    return db.session.scalar(select(MODELS[kind]).filter_by(mbid=mbid))


def get_or_cache_song(mbid: str) -> Song:
    song = find_cached("song", mbid)
    if song is not None:
        return song
    song_id = _upsert_song(musicbrainz().get_song(mbid))
    db.session.commit()
    return db.session.get(Song, song_id)


def get_or_cache_album(mbid: str) -> Album:
    album = find_cached("album", mbid)
    if album is not None and album.fetched_at is not None:
        return album
    detail = musicbrainz().get_album(mbid)
    album_id = _upsert_album(detail.album, fetched_at=func.now())
    for position, track in enumerate(detail.tracks, 1):
        db.session.execute(
            insert(AlbumSong)
            .values(album_id=album_id, song_id=_upsert_song(track), position=position)
            .on_conflict_do_nothing()
        )
    db.session.commit()
    return db.session.get(Album, album_id)


def get_or_cache_artist(mbid: str) -> Artist:
    artist = find_cached("artist", mbid)
    if artist is not None and artist.fetched_at is not None:
        return artist
    client = musicbrainz()
    data = client.get_artist(mbid)
    albums = client.get_artist_albums(data.mbid)
    top_songs = client.top_songs(data)

    artist_id = _upsert_artist(data, fetched_at=func.now())
    for album in albums:
        _upsert_album(album)
    for rank, song in enumerate(top_songs, 1):
        row = {"artist_id": artist_id, "rank": rank, "song_id": _upsert_song(song)}
        db.session.execute(
            insert(ArtistTopSong)
            .values(**row)
            .on_conflict_do_update(index_elements=["artist_id", "rank"], set_=row)
        )
    db.session.commit()
    return db.session.get(Artist, artist_id)


_GETTERS = {"song": get_or_cache_song, "album": get_or_cache_album, "artist": get_or_cache_artist}


def get_or_cache(kind: Kind, mbid: str) -> Song | Album | Artist:
    return _GETTERS[kind](mbid)


def _upsert(model, values: dict, update: dict) -> int:
    statement = insert(model).values(**values)
    # a no-op update still hands back the id of the row that already exists
    statement = statement.on_conflict_do_update(
        index_elements=["mbid"], set_=update or {"mbid": statement.excluded.mbid}
    )
    return db.session.execute(statement.returning(model.id)).scalar_one()


def _upsert_artist(data: ArtistData, **update) -> int:
    return _upsert(Artist, {"mbid": data.mbid, "name": data.name, **update}, update)


def _upsert_album(data: AlbumData, **update) -> int:
    values = {
        "mbid": data.mbid,
        "title": data.title,
        "release_year": data.release_year,
        "artist_id": _upsert_artist(data.artist),
    }
    return _upsert(Album, {**values, **update}, update)


def _upsert_song(data: SongData) -> int:
    values = {
        "mbid": data.mbid,
        "title": data.title,
        "disambiguation": data.disambiguation,
        "length_ms": data.length_ms,
        "artist_id": _upsert_artist(data.artist),
    }
    return _upsert(Song, values, {})
```

Every external call happens before the first write, so an outage partway through leaves the database untouched.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest -v`
Expected: every test passes, including all of slice 02's

- [ ] **Step 6: Lint, format, and commit**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): add cache on touch catalog service and musicbrainz fake"
```

### Task 5: Wire the client into the app and smoke test live

**Files:**
- Modify: `api/app/__init__.py`
- Test: `api/tests/test_errors.py`

**Interfaces:**
- Consumes: Task 2
- Produces: `musicbrainz()` works inside any request

- [ ] **Step 1: Write the failing test**

Add `from app.musicbrainz import MusicBrainzClient` to the imports in `api/tests/test_errors.py`, then append:

```python
def test_app_carries_a_musicbrainz_client():
    app = create_app()

    assert isinstance(app.extensions["musicbrainz"], MusicBrainzClient)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_errors.py -v`
Expected: FAIL with `KeyError: 'musicbrainz'`

- [ ] **Step 3: Register the client**

In `api/app/__init__.py`, import `from app.musicbrainz import MusicBrainzClient` and add this line right after `register_error_handlers(app)`:

```python
    app.extensions["musicbrainz"] = MusicBrainzClient(app.config["MB_USER_AGENT"])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest -v`
Expected: every test passes

- [ ] **Step 5: Smoke test against the live APIs**

```bash
flask shell
```

```python
from app.catalog.service import get_or_cache_album, get_or_cache_artist
album = get_or_cache_album("b1392450-e666-3926-a536-22c65f834433")
[t.song.title for t in album.tracks][:3]
artist = get_or_cache_artist("a74b1b7f-71a5-4011-9441-d0b5e4122711")
[t.song.title for t in artist.top_songs]
```

Expected: the first list starts with `'Airbag', 'Paranoid Android', 'Subterranean Homesick Alien'` and the second holds five Radiohead songs. Run the same lines again and they return instantly, because nothing calls out a second time.

- [ ] **Step 6: Lint, format, commit, and open the pull request**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): register musicbrainz client on the app"
git push -u origin slice/04-music-catalog
gh pr create --fill --base main
```
