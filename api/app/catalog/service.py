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
