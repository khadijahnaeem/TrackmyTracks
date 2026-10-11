from flask import session
from sqlalchemy import select

from app.errors import NotFound, Unauthorized
from app.extensions import db
from app.models import User


def current_user() -> User | None:
    user_id = session.get("user_id")
    if user_id is None:
        return None
    user = db.session.get(User, user_id)
    if user is None:
        # cookie outlived its user
        session.clear()
    return user


def require_user() -> User:
    user = current_user()
    if user is None:
        raise Unauthorized("Log in to continue")
    return user


def user_or_404(username: str) -> User:
    user = db.session.scalar(select(User).filter_by(username=username))
    if user is None:
        raise NotFound("User not found")
    return user


def log_in(user: User) -> None:
    session.clear()
    session["user_id"] = user.id
    session.permanent = True


def log_out() -> None:
    session.clear()
