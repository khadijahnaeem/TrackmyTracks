from sqlalchemy import func, select

from app.extensions import db
from app.models import Friendship


def _befriend(a, b) -> None:
    now = db.session.scalar(select(func.now()))
    db.session.add(Friendship(requester=a, addressee=b, accepted_at=now))
    db.session.commit()


def test_search_is_prefix_and_case_insensitive(client, make_user, login):
    me = make_user("zoe")
    for name in ("sam", "samira", "jordan"):
        make_user(name)
    login(me)
    response = client.get("/api/users?q=SA")
    assert response.status_code == 200
    assert response.get_json() == {"items": [{"username": "sam"}, {"username": "samira"}]}


def test_search_excludes_caller_and_caps_at_20(client, make_user, login):
    users = [make_user(f"user_{i:02d}") for i in range(25)]
    login(users[0])
    items = client.get("/api/users?q=user").get_json()["items"]
    assert len(items) == 20
    assert {"username": "user_00"} not in items


def test_search_rejects_blank_and_long(client, make_user, login):
    login(make_user("alice"))
    assert client.get("/api/users?q=%20%20").status_code == 422
    assert client.get("/api/users").status_code == 422
    assert client.get("/api/users?q=" + "a" * 31).status_code == 422


def test_feed_shows_friends_ratings_newest_first(
    client, make_user, login, make_artist, make_song, make_album, rate
):
    alice, bob = make_user("alice"), make_user("bob")
    _befriend(alice, bob)
    artist = make_artist()
    song, album = make_song(artist), make_album(artist)
    rate(bob, song, 4.5, "Great")
    rate(bob, album, 3.0)
    login(alice)
    body = client.get("/api/feed").get_json()
    assert body["total"] == 2
    first, second = body["items"]
    assert first["kind"] == "album"
    assert first["review"] is None
    assert second["kind"] == "song"
    assert second["review"] == "Great"
    assert second["stars"] == 4.5
    assert second["user"] == {"username": "bob"}
    assert second["item"]["title"] == "Airbag"


def test_feed_excludes_pending_strangers_and_self(
    client, make_user, login, make_artist, make_song, rate
):
    alice, bob, carol, dave = (make_user(n) for n in ("alice", "bob", "carol", "dave"))
    db.session.add(Friendship(requester=alice, addressee=bob))
    db.session.commit()
    song = make_song(make_artist())
    for user in (alice, bob, carol, dave):
        rate(user, song, 4.0)
    login(alice)
    assert client.get("/api/feed").get_json()["items"] == []


def test_feed_drops_unfriended(client, make_user, login, make_artist, make_song, rate):
    alice, bob = make_user("alice"), make_user("bob")
    _befriend(alice, bob)
    rate(bob, make_song(make_artist()), 4.0)
    login(alice)
    assert client.get("/api/feed").get_json()["total"] == 1
    assert client.delete("/api/friends/bob").status_code == 204
    assert client.get("/api/feed").get_json()["total"] == 0


def test_feed_is_empty_page_without_friends(client, make_user, login):
    login(make_user("alice"))
    assert client.get("/api/feed").get_json() == {"items": [], "page": 1, "pages": 0, "total": 0}


def test_search_and_feed_require_login(client):
    assert client.get("/api/users?q=a").status_code == 401
    assert client.get("/api/feed").status_code == 401
