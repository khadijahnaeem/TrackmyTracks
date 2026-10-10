import pytest


@pytest.fixture
def catalog(make_artist, make_song, make_album):
    artist = make_artist()
    songs = [make_song(artist, "Airbag"), make_song(artist, "Lucky")]
    return artist, make_album(artist, songs=songs), songs


def _history(client, username="alice", **params):
    return client.get(f"/api/users/{username}/history", query_string=params)


def test_lists_every_kind_newest_first(client, make_user, catalog, rate):
    alice = make_user()
    artist, album, songs = catalog
    rate(alice, songs[0], 4, review="Great opener")
    rate(alice, album, 4.5)
    rate(alice, artist, 5)

    response = _history(client)

    assert response.status_code == 200
    body = response.json
    assert [(e["kind"], e["stars"]) for e in body["items"]] == [
        ("artist", 5.0),
        ("album", 4.5),
        ("song", 4.0),
    ]
    song_entry = body["items"][2]
    assert song_entry["item"] == {
        "mbid": songs[0].mbid,
        "title": "Airbag",
        "disambiguation": None,
        "length_ms": None,
        "artist": {"mbid": artist.mbid, "name": "Radiohead"},
    }
    assert song_entry["review"] == "Great opener"
    assert "T" in song_entry["updated_at"]
    assert (body["page"], body["pages"], body["total"]) == (1, 1, 3)


def test_filters_by_kind(client, make_user, catalog, rate):
    alice = make_user()
    artist, album, songs = catalog
    rate(alice, songs[0], 4)
    rate(alice, album, 4.5)

    response = _history(client, kind="album")

    assert [e["item"]["title"] for e in response.json["items"]] == ["OK Computer"]


def test_rejects_unknown_kind(client, make_user):
    make_user()

    response = _history(client, kind="playlist")

    assert response.status_code == 422
    assert response.json["error"]["code"] == "validation_error"


def test_derived_ratings_never_appear(client, make_user, catalog, rate):
    alice = make_user()
    _, _, songs = catalog
    for song in songs:
        rate(alice, song, 4)

    response = _history(client)

    assert response.json["total"] == 2
    assert {e["kind"] for e in response.json["items"]} == {"song"}


def test_pages_hold_twenty_entries(client, make_user, make_artist, make_song, rate):
    alice = make_user()
    artist = make_artist()
    for i in range(21):
        rate(alice, make_song(artist, f"Song {i}"), 3)

    response = _history(client, page=2)

    assert (response.json["page"], response.json["pages"], response.json["total"]) == (2, 2, 21)
    assert [e["item"]["title"] for e in response.json["items"]] == ["Song 0"]


def test_unknown_user_is_not_found(client):
    response = _history(client, username="ghost")

    assert response.status_code == 404
    assert response.json["error"] == {"code": "not_found", "message": "User not found"}


def test_excludes_other_users_ratings(client, make_user, catalog, rate):
    make_user("alice")
    _, _, songs = catalog
    rate(make_user("bob"), songs[0], 2)

    response = _history(client)

    assert response.json == {"items": [], "page": 1, "pages": 0, "total": 0}
