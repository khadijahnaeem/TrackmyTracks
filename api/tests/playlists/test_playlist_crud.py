from unittest.mock import ANY

import pytest


def test_create_requires_login(client):
    assert client.post("/api/playlists", json={"name": "Mix"}).status_code == 401


def test_create_trims_and_defaults_to_public(client, login, make_user):
    login(make_user())

    response = client.post("/api/playlists", json={"name": "  Late nights  ", "description": "   "})

    assert response.status_code == 201
    assert response.json == {
        "id": ANY,
        "name": "Late nights",
        "description": None,
        "is_public": True,
        "owner": {"username": "alice"},
        "song_count": 0,
        "updated_at": ANY,
    }


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({"name": "  "}, "Name is required"),
        ({"name": "x" * 101}, "Name must be 100 characters or fewer"),
        ({"name": "Mix", "description": "x" * 501}, "Description must be 500 characters or fewer"),
        ({"name": "Mix", "is_public": "yes"}, "Visibility must be true or false"),
    ],
)
def test_create_validates(client, login, make_user, body, message):
    login(make_user())

    response = client.post("/api/playlists", json=body)

    assert response.status_code == 422
    assert response.json["error"]["message"] == message


def test_list_shows_private_only_to_owner_with_counts(
    client, login, make_user, make_playlist, songs
):
    alice = make_user()
    make_playlist(alice, "Public mix", songs=songs[:2])
    make_playlist(alice, "Drafts", is_public=False)

    def names_and_counts():
        items = client.get("/api/users/alice/playlists").json["items"]
        return [(item["name"], item["song_count"]) for item in items]

    assert names_and_counts() == [("Public mix", 2)]
    login(make_user("bob"))
    assert names_and_counts() == [("Public mix", 2)]
    login(alice)
    assert names_and_counts() == [("Drafts", 0), ("Public mix", 2)]


def test_list_for_unknown_user_is_404(client):
    assert client.get("/api/users/nobody/playlists").status_code == 404


def test_detail_lists_songs_in_order(client, make_user, make_playlist, songs):
    playlist = make_playlist(make_user(), songs=songs)

    response = client.get(f"/api/playlists/{playlist.id}")

    assert [song["title"] for song in response.json["songs"]] == ["Airbag", "Lucky", "Let Down"]
    assert response.json["song_count"] == 3


def test_private_playlist_is_hidden_from_others(client, login, make_user, make_playlist):
    alice = make_user()
    url = f"/api/playlists/{make_playlist(alice, is_public=False).id}"

    assert client.get(url).status_code == 404
    login(make_user("bob"))
    assert client.get(url).status_code == 404
    login(alice)
    assert client.get(url).json["name"] == "Late nights"


def test_owner_updates_fields_partially(client, login, make_user, make_playlist):
    alice = make_user()
    playlist = make_playlist(alice)
    login(alice)

    response = client.patch(
        f"/api/playlists/{playlist.id}", json={"is_public": False, "description": "For the drive"}
    )

    assert response.status_code == 200
    assert (response.json["name"], response.json["description"], response.json["is_public"]) == (
        "Late nights",
        "For the drive",
        False,
    )


def test_only_owner_can_change_or_delete(client, login, make_user, make_playlist):
    url = f"/api/playlists/{make_playlist(make_user()).id}"
    login(make_user("bob"))

    assert client.patch(url, json={"name": "Mine now"}).status_code == 404
    assert client.delete(url).status_code == 404


def test_owner_deletes_playlist(client, login, make_user, make_playlist, songs):
    alice = make_user()
    url = f"/api/playlists/{make_playlist(alice, songs=songs).id}"
    login(alice)

    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404
