from datetime import datetime, timedelta

from sqlalchemy import func, select

from app.extensions import db
from app.models import Friendship


def _request(client, username):
    return client.post("/api/friends/requests", json={"username": username})


def _row_count() -> int:
    return db.session.scalar(select(func.count()).select_from(Friendship))


def test_request_then_accept_makes_friends(client, make_user, login):
    alice, bob = make_user("alice"), make_user("bob")
    login(alice)
    response = _request(client, "bob")
    assert response.status_code == 201
    assert response.get_json() == {"status": "sent"}

    login(bob)
    incoming = client.get("/api/friends").get_json()["incoming"]
    assert [item["user"] for item in incoming] == [{"username": "alice"}]

    accepted = client.post("/api/friends/requests/alice/accept")
    assert accepted.status_code == 200
    assert accepted.get_json() == {"status": "friends"}

    bob_view = client.get("/api/friends").get_json()
    assert [f["user"] for f in bob_view["friends"]] == [{"username": "alice"}]
    assert datetime.fromisoformat(bob_view["friends"][0]["since"])
    assert bob_view["incoming"] == []

    login(alice)
    alice_view = client.get("/api/friends").get_json()
    assert [f["user"] for f in alice_view["friends"]] == [{"username": "bob"}]
    assert alice_view["outgoing"] == []


def test_lists_are_sorted(client, make_user, login):
    me = make_user("me")
    zed, amy, kim, lou = (make_user(name) for name in ("zed", "amy", "kim", "lou"))
    now = db.session.scalar(select(func.now()))
    db.session.add_all(
        [
            Friendship(requester=me, addressee=zed, accepted_at=now),
            Friendship(requester=amy, addressee=me, accepted_at=now),
            Friendship(requester=kim, addressee=me, created_at=now - timedelta(hours=2)),
            Friendship(requester=lou, addressee=me, created_at=now - timedelta(hours=1)),
        ]
    )
    other = make_user("other")
    third = make_user("third")
    db.session.add_all(
        [
            Friendship(requester=me, addressee=other, created_at=now - timedelta(hours=2)),
            Friendship(requester=me, addressee=third, created_at=now - timedelta(hours=1)),
        ]
    )
    db.session.commit()
    login(me)

    data = client.get("/api/friends").get_json()
    assert [f["user"]["username"] for f in data["friends"]] == ["amy", "zed"]
    assert [r["user"]["username"] for r in data["incoming"]] == ["lou", "kim"]
    assert [r["user"]["username"] for r in data["outgoing"]] == ["third", "other"]
    assert all(datetime.fromisoformat(r["sent_at"]) for r in data["incoming"] + data["outgoing"])
    assert all(datetime.fromisoformat(f["since"]) for f in data["friends"])


def test_crossed_request_accepts(client, make_user, login):
    alice, bob = make_user("alice"), make_user("bob")
    login(bob)
    _request(client, "alice")
    login(alice)
    response = _request(client, "bob")
    assert response.status_code == 201
    assert response.get_json() == {"status": "friends"}
    assert _row_count() == 1
    assert len(client.get("/api/friends").get_json()["friends"]) == 1


def test_duplicate_request_conflicts(client, make_user, login):
    alice, bob = make_user("alice"), make_user("bob")
    login(alice)
    assert _request(client, "bob").status_code == 201
    assert _request(client, "bob").status_code == 409

    login(bob)
    client.post("/api/friends/requests/alice/accept")
    assert _request(client, "alice").status_code == 409
    login(alice)
    assert _request(client, "bob").status_code == 409


def test_request_to_self_is_422(client, make_user, login):
    login(make_user("alice"))
    assert _request(client, "alice").status_code == 422


def test_request_to_unknown_is_404(client, make_user, login):
    login(make_user("alice"))
    response = _request(client, "nobody")
    assert response.status_code == 404
    assert response.get_json()["error"]["message"] == "User not found"


def test_request_username_is_case_insensitive(client, make_user, login):
    login(make_user("alice"))
    make_user("bob")
    assert _request(client, "Bob").status_code == 201


def test_only_addressee_can_accept(client, make_user, login):
    alice = make_user("alice")
    make_user("bob")
    login(alice)
    _request(client, "bob")
    response = client.post("/api/friends/requests/bob/accept")
    assert response.status_code == 404
    assert response.get_json()["error"]["message"] == "Friend request not found"
    assert client.post("/api/friends/requests/Nobody/accept").status_code == 404


def test_delete_declines_cancels_and_unfriends(client, make_user, login):
    alice, bob = make_user("alice"), make_user("bob")

    # decline
    login(alice)
    _request(client, "bob")
    login(bob)
    assert client.delete("/api/friends/alice").status_code == 204
    assert _row_count() == 0
    assert client.delete("/api/friends/alice").status_code == 404

    # cancel
    login(alice)
    _request(client, "bob")
    assert client.delete("/api/friends/bob").status_code == 204
    assert _row_count() == 0
    assert client.delete("/api/friends/bob").status_code == 404

    # unfriend
    _request(client, "bob")
    login(bob)
    client.post("/api/friends/requests/alice/accept")
    assert client.delete("/api/friends/alice").status_code == 204
    assert _row_count() == 0
    assert client.delete("/api/friends/alice").status_code == 404


def test_race_on_unique_index_is_not_500(make_user, monkeypatch):
    from app.friends import service

    alice, bob = make_user("alice"), make_user("bob")
    db.session.add(Friendship(requester=bob, addressee=alice))
    db.session.commit()

    real_lookup = service._between
    calls = []

    def missing_once(user, other):
        calls.append(1)
        return None if len(calls) == 1 else real_lookup(user, other)

    monkeypatch.setattr(service, "_between", missing_once)

    assert service.send_request(alice, bob) == "friends"
    assert _row_count() == 1
    assert db.session.scalar(select(Friendship.accepted_at)) is not None


def test_routes_require_login(client):
    assert client.get("/api/friends").status_code == 401
    assert _request(client, "bob").status_code == 401
    assert client.post("/api/friends/requests/bob/accept").status_code == 401
    assert client.delete("/api/friends/bob").status_code == 401
