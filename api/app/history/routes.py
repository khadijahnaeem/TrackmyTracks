from flask import Blueprint, request
from sqlalchemy import select
from sqlalchemy.orm import lazyload

from app.auth.session import user_or_404
from app.catalog.serializers import SUMMARIES
from app.http import page_arg, paginate, parse_kind
from app.kinds import RATING_TARGETS, kind_of
from app.models import Rating
from app.ratings.service import rating_fields

bp = Blueprint("history", __name__, url_prefix="/api")


def _entry(rating: Rating) -> dict:
    target = rating.song or rating.album or rating.artist
    kind = kind_of(target)
    return {**rating_fields(rating), "kind": kind, "item": SUMMARIES[kind](target)}


@bp.get("/users/<username>/history")
def user_history(username: str):
    user = user_or_404(username)
    # explicit rows only, derived album and artist ratings live in the views
    query = (
        select(Rating)
        .options(lazyload(Rating.user))
        .where(Rating.user_id == user.id)
        .order_by(Rating.updated_at.desc(), Rating.id.desc())
    )
    kind = request.args.get("kind")
    if kind is not None:
        query = query.where(RATING_TARGETS[parse_kind(kind)].is_not(None))
    return paginate(query, _entry, page_arg())
