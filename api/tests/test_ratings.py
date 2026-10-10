import pytest
from sqlalchemy import func, select

from app.catalog.service import find_cached
from app.extensions import db
from app.models import Rating
from tests.fakes import KARMA_POLICE, OK_COMPUTER

UNKNOWN = "00000000-0000-4000-8000-000000000002"


@pytest.fixture
def alice(make_user, login):
    user = make_user()
    login(user)
    return user


def _put(client, **body):
    return client.put(
        "/api/ratings", json={"kind": "song", "mbid": KARMA_POLICE, "stars": 4, **body}
    )


def test_rating_requires_login(client):
    response = _put(client)

    assert response.status_code == 401
    assert response.json["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(
    "body",
    [
        {"stars": 0},
        {"stars": 5.5},
        {"stars": 3.3},
        {"stars": "4"},
        {"stars": True},
        {"kind": "playlist"},
        {"mbid": "not-an-id"},
        {"review": "x" * 2001},
    ],
)
def test_invalid_rating_is_rejected(client, alice, body):
    response = _put(client, **body)

    assert response.status_code == 422
    assert response.json["error"]["code"] == "validation_error"


@pytest.mark.parametrize(("stars", "score"), [(0.5, 1), (5, 10)])
def test_boundary_stars_are_accepted(client, alice, stars, score):
    response = _put(client, stars=stars)

    assert response.status_code == 200
    assert db.session.scalar(select(Rating.score)) == score
    assert response.json["rating"]["mine"]["stars"] == stars


def test_rating_caches_the_song_and_returns_its_summary(client, alice):
    response = _put(client, stars=3.5, review="  Still gets me  ")

    assert response.status_code == 200
    assert response.json == {
        "mbid": KARMA_POLICE,
        "rating": {
            "mine": {
                "stars": 3.5,
                "is_derived": False,
                "song_count": 0,
                "review": "Still gets me",
            },
            "community": {"stars": 3.5, "count": 1},
        },
    }


def test_whitespace_review_is_stored_as_null(client, alice):
    _put(client, review="   ")

    assert db.session.scalar(select(Rating.review)) is None


def test_rating_twice_updates_one_row_and_keeps_the_review(client, alice):
    _put(client, stars=2, review="First take")
    response = _put(client, stars=4.5)

    assert db.session.scalar(select(func.count()).select_from(Rating)) == 1
    assert response.json["rating"]["mine"] == {
        "stars": 4.5,
        "is_derived": False,
        "song_count": 0,
        "review": "First take",
    }


def test_empty_review_clears_it(client, alice):
    _put(client, review="First take")
    response = _put(client, review="")

    assert response.json["rating"]["mine"]["review"] is None


def test_null_review_clears_it(client, alice):
    _put(client, review="First take")
    response = _put(client, review=None)

    assert response.json["rating"]["mine"]["review"] is None


def test_unknown_mbid_is_not_found(client, alice):
    assert _put(client, mbid=UNKNOWN).status_code == 404


def test_clearing_requires_login(client):
    response = client.delete(f"/api/ratings/song/{KARMA_POLICE}")

    assert response.status_code == 401
    assert response.json["error"]["code"] == "unauthorized"


def test_clearing_an_invalid_kind_is_rejected(client, alice):
    response = client.delete(f"/api/ratings/playlist/{KARMA_POLICE}")

    assert response.status_code == 422
    assert response.json["error"] == {
        "code": "validation_error",
        "message": "Kind must be song, album, or artist",
    }


def test_clearing_an_album_override_restores_the_average(client, alice):
    _put(client, kind="album", mbid=OK_COMPUTER, stars=4.5)
    album = find_cached("album", OK_COMPUTER)
    for track, stars in zip(album.tracks, (3.5, 4, 3.5), strict=True):
        _put(client, kind="song", mbid=track.song.mbid, stars=stars)

    response = client.delete(f"/api/ratings/album/{OK_COMPUTER}")

    assert response.status_code == 200
    assert response.json["rating"]["mine"] == {
        "stars": 3.7,
        "is_derived": True,
        "song_count": 3,
        "review": None,
    }


def test_clearing_an_unrated_cached_entity_changes_nothing(client, alice, make_artist):
    artist = make_artist()

    response = client.delete(f"/api/ratings/artist/{artist.mbid}")

    assert response.status_code == 200
    assert response.json == {
        "mbid": artist.mbid,
        "rating": {"mine": None, "community": {"stars": None, "count": 0}},
    }


def test_clearing_an_uncached_entity_is_not_found(client, alice, fake_mb):
    response = client.delete(f"/api/ratings/song/{KARMA_POLICE}")

    assert response.status_code == 404
    assert fake_mb.calls == []
