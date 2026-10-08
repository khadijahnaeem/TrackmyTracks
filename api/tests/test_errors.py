from unittest.mock import ANY

from app import create_app
from app.errors import NotFound
from app.musicbrainz import MusicBrainzClient


def test_unknown_route_returns_json_404(client):
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    assert response.json == {"error": {"code": "not_found", "message": ANY}}


def test_api_error_uses_error_shape():
    app = create_app({"TESTING": True})

    @app.get("/boom")
    def boom():
        raise NotFound("Album not found")

    response = app.test_client().get("/boom")

    assert response.status_code == 404
    assert response.json == {"error": {"code": "not_found", "message": "Album not found"}}


def test_unhandled_exception_returns_json_500():
    app = create_app()

    @app.get("/crash")
    def crash():
        raise RuntimeError("boom")

    response = app.test_client().get("/crash")

    assert response.status_code == 500
    assert response.json["error"]["code"] == "internal_server_error"


def test_http_error_keeps_its_headers():
    app = create_app({"TESTING": True})

    @app.post("/only-post")
    def only_post():
        return {}

    response = app.test_client().get("/only-post")

    assert response.status_code == 405
    assert response.json["error"]["code"] == "method_not_allowed"
    assert set(response.headers["Allow"].split(", ")) >= {"POST", "OPTIONS"}


def test_app_carries_a_musicbrainz_client():
    app = create_app()

    assert isinstance(app.extensions["musicbrainz"], MusicBrainzClient)
