from flask import session

from app.errors import Unauthorized
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


def log_in(user: User) -> None:
    session.clear()
    session["user_id"] = user.id
    session.permanent = True


def log_out() -> None:
    session.clear()
