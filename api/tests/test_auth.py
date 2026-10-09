from unittest.mock import ANY

import pytest

from app.auth.serializers import public_user

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"
USERNAME_RULE = "Username must be 3 to 30 lowercase letters, numbers, or underscores"
PASSWORD_RULE = "Password must be 8 to 128 characters"


def _register(client, **overrides):
    body = {
        "email": " Alice@Example.com ",
        "username": " Alice_1 ",
        "password": "password123",
        **overrides,
    }
    return client.post(REGISTER, json=body)


def test_register_normalizes_and_logs_in(client):
    response = _register(client)

    assert response.status_code == 201
    assert response.json == {
        "user": {"id": ANY, "username": "alice_1", "email": "alice@example.com"}
    }
    assert client.get("/api/auth/me").json["user"]["username"] == "alice_1"


def test_register_sets_an_http_only_lax_session_cookie(client):
    cookie = _register(client).headers["Set-Cookie"]

    assert cookie.startswith("session=")
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"email": "  "}, "Email is required"),
        ({"email": "not-an-email"}, "Enter a valid email address"),
        ({"username": "ab"}, USERNAME_RULE),
        ({"username": "has space"}, USERNAME_RULE),
        ({"username": "x" * 31}, "Username must be 30 characters or fewer"),
        ({"password": "short"}, PASSWORD_RULE),
        ({"password": "x" * 129}, PASSWORD_RULE),
        ({"password": 12345678}, PASSWORD_RULE),
    ],
)
def test_register_validates(client, overrides, message):
    response = _register(client, **overrides)

    assert response.status_code == 422
    assert response.json["error"] == {"code": "validation_error", "message": message}


def test_register_requires_a_json_object(client):
    assert client.post(REGISTER, json=["alice"]).status_code == 422


def test_register_rejects_a_taken_email(client, make_user):
    make_user("alice")

    response = _register(client, username="someone_else")

    assert response.status_code == 409
    assert response.json["error"] == {"code": "conflict", "message": "Email is already registered"}


def test_register_rejects_a_taken_username(client, make_user):
    make_user("alice_1")

    response = _register(client, email="other@example.com")

    assert response.status_code == 409
    assert response.json["error"] == {"code": "conflict", "message": "Username is taken"}


def test_login_ignores_email_case(client, make_user):
    make_user("alice")

    response = client.post(LOGIN, json={"email": "ALICE@example.com", "password": "password123"})

    assert response.status_code == 200
    assert response.json["user"]["username"] == "alice"


@pytest.mark.parametrize(
    "body",
    [
        {"email": "alice@example.com", "password": "wrong-password"},
        {"email": "nobody@example.com", "password": "password123"},
    ],
)
def test_login_hides_which_part_was_wrong(client, make_user, body):
    make_user("alice")

    response = client.post(LOGIN, json=body)

    assert response.status_code == 401
    assert response.json["error"] == {
        "code": "unauthorized",
        "message": "Email or password is incorrect",
    }


def test_logout_clears_the_session(client, make_user):
    make_user("alice")
    client.post(LOGIN, json={"email": "alice@example.com", "password": "password123"})

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").json == {"user": None}


def test_me_is_null_when_logged_out(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json == {"user": None}


def test_public_user_hides_email(make_user):
    assert public_user(make_user("alice")) == {"username": "alice"}
