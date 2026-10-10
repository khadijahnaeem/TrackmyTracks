from collections.abc import Callable
from typing import Any

from app.kinds import Kind


def artist_summary(artist: Any) -> dict:
    return {"mbid": artist.mbid, "name": artist.name}


def album_summary(album: Any) -> dict:
    return {
        "mbid": album.mbid,
        "title": album.title,
        "release_year": album.release_year,
        "artist": artist_summary(album.artist),
    }


def song_summary(song: Any) -> dict:
    return {
        "mbid": song.mbid,
        "title": song.title,
        "disambiguation": song.disambiguation,
        "length_ms": song.length_ms,
        "artist": artist_summary(song.artist),
    }


def song_result(song: Any) -> dict:
    return {**song_summary(song), "listens": song.listens}


SUMMARIES: dict[Kind, Callable[[Any], dict]] = {
    "song": song_summary,
    "album": album_summary,
    "artist": artist_summary,
}
# search rows also say how often a song was played
SEARCH_RESULTS: dict[Kind, Callable[[Any], dict]] = {**SUMMARIES, "song": song_result}
