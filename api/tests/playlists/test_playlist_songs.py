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

    after = client.post(f"/api/playlists/{playlist.id}/songs", json={"mbid": songs[0].mbid}).json[
        "updated_at"
    ]

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
