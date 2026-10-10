from datetime import UTC, datetime

import pytest

from app.extensions import db
from tests.fakes import KARMA_POLICE, OK_COMPUTER


@pytest.fixture
def song(make_artist, make_song):
    return make_song(make_artist(), "Karma Police")


def test_reviews_are_newest_first_and_skip_rating_only_rows(client, song, make_user, rate):
    older = rate(make_user("alice"), song, 3, review="Grower")
    older.updated_at = datetime(2026, 1, 1, tzinfo=UTC)
    db.session.commit()
    newer = rate(make_user("bob"), song, 4.5, review="Instant classic")
    rate(make_user("cal"), song, 2)

    response = client.get(f"/api/songs/{song.mbid}/reviews")

    assert response.status_code == 200
    body = response.json
    assert [(r["user"], r["stars"], r["review"]) for r in body["items"]] == [
        ({"username": "bob"}, 4.5, "Instant classic"),
        ({"username": "alice"}, 3.0, "Grower"),
    ]
    assert body["items"][0]["id"] == newer.id
    assert body["items"][0]["updated_at"] == newer.updated_at.isoformat()
    assert (body["page"], body["pages"], body["total"]) == (1, 1, 2)


def test_artist_reviews_are_listed(client, make_artist, make_user, rate):
    artist = make_artist()
    rate(make_user("alice"), artist, 4, review="Never misses")

    response = client.get(f"/api/artists/{artist.mbid}/reviews")

    assert [(r["user"], r["stars"], r["review"]) for r in response.json["items"]] == [
        ({"username": "alice"}, 4.0, "Never misses")
    ]


def test_whitespace_review_never_reaches_the_feed(client, make_user, login):
    login(make_user())
    client.put(
        "/api/ratings",
        json={"kind": "song", "mbid": KARMA_POLICE, "stars": 4, "review": "   "},
    )

    assert client.get(f"/api/songs/{KARMA_POLICE}/reviews").json["items"] == []


def test_reviews_page_twenty_at_a_time(client, song, make_user, rate):
    for i in range(21):
        rate(make_user(f"user{i:02d}"), song, 4, review=f"Review {i}")

    response = client.get(f"/api/songs/{song.mbid}/reviews?page=2")

    assert len(response.json["items"]) == 1
    assert (response.json["pages"], response.json["total"]) == (2, 21)


def test_uncached_entity_has_no_reviews_and_no_lookup(client, fake_mb):
    response = client.get(f"/api/albums/{OK_COMPUTER}/reviews")

    assert response.json == {"items": [], "page": 1, "pages": 0, "total": 0}
    assert fake_mb.calls == []
