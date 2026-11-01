from flask import Blueprint, request
from sqlalchemy import select

from app.auth.serializers import public_user
from app.auth.session import require_user, user_or_404
from app.extensions import db
from app.friends.service import (
    accept_request,
    friend_ids,
    friends_payload,
    remove_friend,
    send_request,
)
from app.http import json_body, page_arg, paginate, required_text
from app.models import Rating, User
from app.ratings.entries import rating_entry

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


@bp.get("/users")
def search_users():
    user = require_user()
    query = required_text({"q": request.args.get("q")}, "q", 30).lower()
    rows = db.session.scalars(
        select(User)
        .where(User.username.startswith(query, autoescape=True), User.id != user.id)
        .order_by(User.username)
        .limit(20)
    )
    return {"items": [public_user(row) for row in rows]}


@bp.get("/feed")
def feed():
    user = require_user()
    query = (
        select(Rating)
        .where(Rating.user_id.in_(friend_ids(user)))
        .order_by(Rating.updated_at.desc(), Rating.id.desc())
    )
    return paginate(
        query, lambda rating: {**rating_entry(rating), "user": public_user(rating.user)}, page_arg()
    )
