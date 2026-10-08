import re
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass

import requests
from flask import current_app

from app.errors import CatalogUnavailable, NotFound

MB_ROOT = "https://musicbrainz.org/ws/2"
LB_ROOT = "https://api.listenbrainz.org/1"
TIMEOUT_SECONDS = 5
MIN_INTERVAL_SECONDS = 1.0
UNAVAILABLE = "Music catalog is unavailable, try again"
SEARCH_PAGE_SIZE = 25
LUCENE_SPECIAL = re.compile(r'([+\-&|!(){}\[\]^"~*?:\\/])')


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


def _escape(query: str) -> str:
    return LUCENE_SPECIAL.sub(r"\\\1", query)


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
