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
from app.musicbrainz import UNAVAILABLE
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
    db.session.add(
        Song(mbid=AIRBAG, title="Airbag", artist=Artist(mbid=RADIOHEAD, name="Radiohead"))
    )
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


def test_outage_midway_writes_nothing(fake_mb):
    top_songs_route = f"/popularity/top-recordings-for-artist/{RADIOHEAD}"
    fake_mb.routes[top_songs_route] = CatalogUnavailable(UNAVAILABLE)

    with pytest.raises(CatalogUnavailable):
        get_or_cache_artist(RADIOHEAD)
    assert [_count(model) for model in (Artist, Album, Song)] == [0, 0, 0]


def test_a_lost_cache_race_leaves_one_row(fake_mb, monkeypatch):
    # the second request looked before the first one committed
    monkeypatch.setattr("app.catalog.service.find_cached", lambda kind, mbid: None)

    first = get_or_cache_song(KARMA_POLICE)
    second = get_or_cache_song(KARMA_POLICE)

    assert first.id == second.id
    assert _count(Song) == 1


def test_find_cached_never_calls_out(fake_mb):
    assert find_cached("album", OK_COMPUTER) is None
    get_or_cache("album", OK_COMPUTER)
    fake_mb.calls.clear()

    assert find_cached("album", OK_COMPUTER).title == "OK Computer"
    assert fake_mb.calls == []
