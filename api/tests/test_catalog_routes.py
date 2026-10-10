import uuid
from math import ceil

import pytest
from sqlalchemy import func, select

from app.catalog.service import (
    find_cached,
    get_or_cache_album,
    get_or_cache_artist,
    get_or_cache_song,
)
from app.extensions import db
from app.models import Album, Artist, Song
from tests.fakes import AIRBAG, KARMA_POLICE, OK_COMPUTER, RADIOHEAD


@pytest.mark.parametrize(
    ("kind", "query", "first"),
    [
        ("song", "northern star dom fera", "Northern Star"),
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
    query = {"type": "song", "q": "northern star hole live"}
    body = client.get("/api/search", query_string=query).json

    assert body["total"] == 100
    assert body["items"][1] == {
        "mbid": "5263db9a-8565-4e26-a7ca-c8e16cca60ab",
        "title": "Northern Star",
        "disambiguation": "live, 1999-05-09: Music Midtown, Atlanta, GA, USA",
        "length_ms": 400000,
        "artist": {"mbid": "1dcc8968-f2cd-441c-beda-6270f70f2863", "name": "Hole"},
        "listens": 0,
    }


def test_song_search_carries_listen_counts(client):
    query = {"type": "song", "q": "northern star dom fera"}
    first = client.get("/api/search", query_string=query).json["items"][0]

    assert (first["title"], first["listens"]) == ("Northern Star", 2042)


def test_artist_search_hides_artists_with_nothing_released(client):
    body = client.get("/api/search", query_string={"type": "artist", "q": "radiohead"}).json

    names = [artist["name"] for artist in body["items"]]
    assert body["total"] == len(names) == 13
    assert "Gazz" in names
    assert "Fake Plastic Radiohead" not in names
    assert body["items"][0] == {"mbid": RADIOHEAD, "name": "Radiohead", "listens": 134659628}


def test_search_caches_nothing(client):
    for kind in ("song", "album", "artist"):
        assert (
            client.get("/api/search", query_string={"type": kind, "q": "radiohead"}).status_code
            == 200
        )

    for model in (Song, Album, Artist):
        assert db.session.scalar(select(func.count()).select_from(model)) == 0


@pytest.mark.parametrize(
    ("query_string", "message"),
    [
        ({"type": "playlist", "q": "x"}, "Type must be song, album, or artist"),
        ({"q": "x"}, "Type must be song, album, or artist"),
        ({"type": "song", "q": "   "}, "Query is required"),
        ({"type": "song", "q": "x" * 201}, "Query must be 200 characters or fewer"),
        ({"type": "song", "q": "x", "page": "0"}, "Page must be between 1 and 10000"),
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
