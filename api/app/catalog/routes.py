from collections.abc import Sequence
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
from app.models import Album, Artist, Song
from app.musicbrainz import SEARCH_PAGE_SIZE, musicbrainz
from app.ratings.queries import rating_summaries

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
    if results.listens is not None:
        # song and artist rows also say how often each was played
        items = [{**item, "listens": results.listens.get(item["mbid"], 0)} for item in items]
    return page_payload(items, page, results.total, SEARCH_PAGE_SIZE)


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


# a fixed number of ratings queries runs per kind no matter how many entities the page shows
def _rated(kind: Kind, entities: Sequence[Song | Album | Artist]) -> list[dict]:
    user = current_user()
    ratings = rating_summaries(user.id if user else None, kind, [entity.id for entity in entities])
    return [{**SUMMARIES[kind](entity), "rating": ratings[entity.id]} for entity in entities]
