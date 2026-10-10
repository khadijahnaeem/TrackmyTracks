from flask import Blueprint, request
from sqlalchemy import select

from app.catalog.serializers import SUMMARIES
from app.errors import NotFound, ValidationError
from app.extensions import db
from app.http import page_arg, paginate
from app.kinds import KINDS, kind_of
from app.models import Rating, User

bp = Blueprint("history", __name__, url_prefix="/api")


def _entry(rating: Rating) -> dict:
    target = rating.song or rating.album or rating.artist
    kind = kind_of(target)
    return {
        "id": rating.id,
        "kind": kind,
        "item": SUMMARIES[kind](target),
        "stars": rating.score / 2,
        "review": rating.review,
        "updated_at": rating.updated_at.isoformat(),
    }


@bp.get("/users/<username>/history")
def user_history(username: str):
    user = db.session.scalar(select(User).filter_by(username=username))
    if user is None:
        raise NotFound("User not found")

    # explicit rows only, derived album and artist ratings live in the views
    query = (
        select(Rating)
        .where(Rating.user_id == user.id)
        .order_by(Rating.updated_at.desc(), Rating.id.desc())
    )
    kind = request.args.get("kind")
    if kind is not None:
        if kind not in KINDS:
            raise ValidationError("Kind must be song, album, or artist")
        query = query.where(getattr(Rating, f"{kind}_id").is_not(None))
    return paginate(query, _entry, page_arg())
