from flask import Blueprint

from app.auth.session import require_user, user_or_404
from app.friends.service import (
    accept_request,
    friends_payload,
    remove_friend,
    send_request,
)
from app.http import json_body, required_text

bp = Blueprint("friends", __name__, url_prefix="/api")


@bp.get("/friends")
def list_friends():
    return friends_payload(require_user())


@bp.post("/friends/requests")
def request_friend():
    user = require_user()
    username = required_text(json_body(), "username", 30)
    status = send_request(user, user_or_404(username.lower()))
    return {"status": status}, 201


@bp.post("/friends/requests/<username>/accept")
def accept_friend(username: str):
    user = require_user()
    accept_request(user, user_or_404(username.lower()))
    return {"status": "friends"}


@bp.delete("/friends/<username>")
def delete_friend(username: str):
    user = require_user()
    remove_friend(user, user_or_404(username.lower()))
    return "", 204
