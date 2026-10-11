import re

from flask import Blueprint
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from app.auth.serializers import user_payload
from app.auth.session import current_user, log_in, log_out
from app.errors import Conflict, Unauthorized, ValidationError
from app.extensions import db
from app.http import json_body, required_text
from app.models import User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME = re.compile(r"^[a-z0-9_]{3,30}$")
USERNAME_RULE = "Username must be 3 to 30 lowercase letters, numbers, or underscores"
MAX_PASSWORD = 128
# unknown emails still pay for one hash check, so response time never reveals who is registered
DECOY_HASH = generate_password_hash("decoy password that never matches")
CONFLICTS = {
    "uq_users_email": "Email is already registered",
    "uq_users_username": "Username is taken",
}


def _email(data: dict) -> str:
    email = required_text(data, "email", 254).lower()
    if not EMAIL.match(email):
        raise ValidationError("Enter a valid email address")
    return email


def _username(data: dict) -> str:
    username = required_text(data, "username", 30).lower()
    if not USERNAME.match(username):
        raise ValidationError(USERNAME_RULE)
    return username


# passwords are never trimmed, spaces are valid characters
def _password(data: dict) -> str:
    password = data.get("password")
    if not isinstance(password, str) or not 8 <= len(password) <= MAX_PASSWORD:
        raise ValidationError("Password must be 8 to 128 characters")
    return password


@bp.post("/register")
def register():
    data = json_body()
    user = User(
        email=_email(data),
        username=_username(data),
        password_hash=generate_password_hash(_password(data)),
    )
    db.session.add(user)
    # the unique constraints decide, so two signups racing for one name cannot both win
    try:
        db.session.commit()
    except IntegrityError as error:
        db.session.rollback()
        raise Conflict(CONFLICTS[error.orig.diag.constraint_name]) from error
    log_in(user)
    return {"user": user_payload(user)}, 201


@bp.post("/login")
def login():
    data = json_body()
    email = required_text(data, "email", 254).lower()
    password = data.get("password")
    # no stored password is longer, so overlong input is wrong without the cost of hashing it
    if not isinstance(password, str) or len(password) > MAX_PASSWORD:
        raise Unauthorized("Email or password is incorrect")
    user = db.session.scalar(select(User).filter_by(email=email))
    matches = check_password_hash(user.password_hash if user else DECOY_HASH, password)
    if user is None or not matches:
        raise Unauthorized("Email or password is incorrect")
    log_in(user)
    return {"user": user_payload(user)}


@bp.post("/logout")
def logout():
    log_out()
    return "", 204


@bp.get("/me")
def me():
    user = current_user()
    return {"user": user_payload(user) if user else None}
