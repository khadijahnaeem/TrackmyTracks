import codecs
import json
import re
import threading
import time
import unicodedata
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from itertools import islice

import requests
from flask import current_app

from app.errors import CatalogUnavailable, NotFound

MB_ROOT = "https://musicbrainz.org/ws/2"
LB_ROOT = "https://api.listenbrainz.org/1"
TIMEOUT_SECONDS = 5
MIN_INTERVAL_SECONDS = 1.0
UNAVAILABLE = "Music catalog is unavailable, try again"
SEARCH_PAGE_SIZE = 25
# the most results musicbrainz returns per request
MB_MAX_LIMIT = 100
LUCENE_SPECIAL = re.compile(r'([+\-&|!(){}\[\]^"~*?:\\/])')
JSON_ARRAY_GAP = re.compile(r"[\s,\[\]]*")
WORD = re.compile(r"\w+")


@dataclass(frozen=True)
class ArtistData:
    mbid: str
    name: str
    # only search knows how often an artist was played
    listens: int | None = None


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
    # only search knows how often a recording was played
    listens: int | None = None


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


def _song(recording: dict, listens: int | None = None) -> SongData:
    return SongData(
        recording["id"],
        recording["title"],
        recording.get("disambiguation") or None,
        recording.get("length"),
        _artist(recording["artist-credit"]),
        listens,
    )


def _earliest_release(releases: list[dict]) -> str:
    # unofficial releases only count when an album has nothing official
    candidates = [r for r in releases if r.get("status") == "Official"] or releases
    return min(candidates, key=lambda r: r.get("date") or "9999")["id"]


def _escape(query: str) -> str:
    return LUCENE_SPECIAL.sub(r"\\\1", query)


def _words(text: str) -> set[str]:
    # case and accents never decide a match, so bjork finds Bjork with its umlaut
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return set(WORD.findall("".join(c for c in decomposed if not unicodedata.combining(c))))


def _page[T](items: list[T], page: int) -> SearchResults[T]:
    offset = (page - 1) * SEARCH_PAGE_SIZE
    return SearchResults(items[offset : offset + SEARCH_PAGE_SIZE], len(items))


def json_array_items(chunks: Iterable[bytes]) -> Iterator[dict]:
    """Yields each element of a streamed JSON array as soon as it has fully arrived"""
    decoder, text, buffer = json.JSONDecoder(), codecs.getincrementaldecoder("utf-8")(), ""
    for chunk in chunks:
        buffer += text.decode(chunk)
        position = 0
        while True:
            position = JSON_ARRAY_GAP.match(buffer, position).end()
            try:
                item, position = decoder.raw_decode(buffer, position)
            except json.JSONDecodeError:
                break
            yield item
        buffer = buffer[position:]
    if buffer:
        raise ValueError("JSON array ended early")


def _streamed_items(response: requests.Response) -> Iterator[dict]:
    with response:
        try:
            yield from json_array_items(response.iter_content(chunk_size=None))
        except (requests.RequestException, ValueError) as error:
            raise CatalogUnavailable(UNAVAILABLE) from error


class MusicBrainzClient:
    def __init__(self, user_agent: str, listenbrainz_token: str):
        self._http = requests.Session()
        self._http.headers["User-Agent"] = user_agent
        self._listenbrainz_auth = {"Authorization": f"Token {listenbrainz_token}"}
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
        if not group["releases"]:
            return AlbumDetail(_album(group), [])
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
            rows = self._request(
                f"{LB_ROOT}/popularity/top-recordings-for-artist/{artist.mbid}",
                {},
                self._listenbrainz_auth,
                stream=True,
            )
        except NotFound:
            # artists nobody has listened to have no popularity data
            return []
        # features and guest credits belong to the first credited artist
        own = (row for row in rows if row.get("artist_mbids", [])[:1] == [artist.mbid])
        # rows come most played first and can run to megabytes, so reading stops at the limit
        return [
            SongData(row["recording_mbid"], row["recording_name"], None, row.get("length"), artist)
            for row in islice(own, limit)
        ]

    def search_artists(self, query: str, page: int) -> SearchResults[ArtistData]:
        # artists with nothing released are dropped, so the top matches are filtered and paged here
        matches = self._mb("/artist", query=_escape(query), limit=MB_MAX_LIMIT)["artists"]
        mbids = [artist["id"] for artist in matches]
        listens = self._listens("artist", mbids)
        # without listen counts nothing can be judged unreleased, so every match stays
        published = set(mbids) if listens is None else self._published(mbids, listens)
        counts = listens or {}
        artists = [
            ArtistData(artist["id"], artist["name"], counts.get(artist["id"], 0))
            for artist in matches
            if artist["id"] in published
        ]
        return _page(artists, page)

    def search_albums(self, query: str, page: int) -> SearchResults[AlbumData]:
        lucene = f"releasegroup:({_escape(query)}) AND primarytype:album"
        offset = (page - 1) * SEARCH_PAGE_SIZE
        data = self._mb("/release-group", query=lucene, limit=SEARCH_PAGE_SIZE, offset=offset)
        return SearchResults([_album(group) for group in data["release-groups"]], data["count"])

    def search_songs(self, query: str, page: int) -> SearchResults[SongData]:
        # musicbrainz ties thousands of matches at full score, so the top matches are reranked here
        recordings = self._mb("/recording", query=_escape(query), limit=MB_MAX_LIMIT)["recordings"]
        listens = self._listens("recording", [recording["id"] for recording in recordings]) or {}
        terms = _words(query)

        # recordings matching more of the query lead, then the most played
        def rank(recording: dict) -> tuple[int, int]:
            names = " ".join(credit["name"] for credit in recording["artist-credit"])
            text = f"{recording['title']} {recording.get('disambiguation', '')} {names}"
            return -len(terms & _words(text)), -listens.get(recording["id"], 0)

        ranked = sorted(recordings, key=rank)
        songs = [_song(recording, listens.get(recording["id"], 0)) for recording in ranked]
        return _page(songs, page)

    def _listens(self, kind: str, mbids: list[str]) -> dict[str, int] | None:
        """Listen counts by mbid, or None when ListenBrainz cannot answer"""
        if not mbids:
            return {}
        try:
            rows = self._request(
                f"{LB_ROOT}/popularity/{kind}",
                {},
                self._listenbrainz_auth,
                body={f"{kind}_mbids": mbids},
            )
        except (CatalogUnavailable, NotFound) as error:
            # counts only rank and annotate, so search carries on with musicbrainz alone
            current_app.logger.warning("ListenBrainz %s popularity failed: %s", kind, error)
            return None
        # anything nobody has played comes back as null
        return {row[f"{kind}_mbid"]: row["total_listen_count"] or 0 for row in rows}

    def _published(self, mbids: list[str], listens: dict[str, int]) -> set[str]:
        # anyone someone has listened to has released something
        heard = {mbid for mbid, count in listens.items() if count}
        unheard = [mbid for mbid in mbids if mbid not in heard]
        if not unheard:
            return heard
        # unheard artists are kept when any recording credits them
        data = self._mb("/recording", query=f"arid:({' OR '.join(unheard)})", limit=MB_MAX_LIMIT)
        credited = {
            credit["artist"]["id"]
            for recording in data["recordings"]
            for credit in recording["artist-credit"]
        }
        return heard | credited.intersection(unheard)

    def _mb(self, path: str, **params) -> dict:
        # musicbrainz allows one request per second per client
        with self._lock:
            wait = self._next_request_at - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            try:
                return self._request(f"{MB_ROOT}{path}", {**params, "fmt": "json"})
            finally:
                self._next_request_at = time.monotonic() + MIN_INTERVAL_SECONDS

    def _request(
        self,
        url: str,
        params: dict,
        headers: dict | None = None,
        stream: bool = False,
        body: dict | None = None,
    ):
        try:
            response = self._http.request(
                "GET" if body is None else "POST",
                url,
                params=params,
                json=body,
                headers=headers,
                timeout=TIMEOUT_SECONDS,
                stream=stream,
            )
        except requests.RequestException as error:
            raise CatalogUnavailable(UNAVAILABLE) from error
        if not response.ok:
            response.close()
            if response.status_code in (400, 404):
                raise NotFound("Not found in the music catalog")
            raise CatalogUnavailable(UNAVAILABLE)
        if stream:
            return _streamed_items(response)
        try:
            return response.json()
        except ValueError as error:
            raise CatalogUnavailable(UNAVAILABLE) from error


def musicbrainz() -> MusicBrainzClient:
    return current_app.extensions["musicbrainz"]
