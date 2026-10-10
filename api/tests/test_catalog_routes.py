from math import ceil

import pytest
from sqlalchemy import func, select

from app.extensions import db
from app.models import Album, Artist, Song
from tests.fakes import RADIOHEAD


@pytest.mark.parametrize(
    ("kind", "query", "first"),
    [
        ("song", "karma police", "Karma Police"),
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
    body = client.get("/api/search", query_string={"type": "song", "q": "karma"}).json

    assert body["total"] == 34017
    assert body["items"][1] == {
        "mbid": "6a29ed9f-b78c-4281-902a-8ff78af43f67",
        "title": "Karma Police",
        "disambiguation": "live, 1997-12-19: Hammerstein Ballroom, New York City, NY, USA",
        "length_ms": 253720,
        "artist": {"mbid": RADIOHEAD, "name": "Radiohead"},
    }


def test_search_caches_nothing(client):
    for kind in ("song", "album", "artist"):
        client.get("/api/search", query_string={"type": kind, "q": "radiohead"})

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
