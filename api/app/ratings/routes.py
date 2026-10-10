import uuid

from flask import Blueprint

from app.auth.session import require_user
from app.http import json_body, optional_text
from app.ratings.service import (
    REVIEW_MAX_LENGTH,
    clear_rating,
    parse_kind,
    parse_mbid,
    parse_stars,
    save_rating,
)

bp = Blueprint("ratings", __name__, url_prefix="/api")


@bp.put("/ratings")
def put_rating():
    user = require_user()
    data = json_body()
    kind = parse_kind(data.get("kind"))
    mbid = parse_mbid(data.get("mbid"))
    changes = {"score": parse_stars(data.get("stars"))}
    # a missing review key keeps the review already saved
    if "review" in data:
        changes["review"] = optional_text(data, "review", REVIEW_MAX_LENGTH)
    return save_rating(user, kind, mbid, changes)


@bp.delete("/ratings/<kind>/<uuid:mbid>")
def delete_rating(kind: str, mbid: uuid.UUID):
    user = require_user()
    return clear_rating(user, parse_kind(kind), str(mbid))
