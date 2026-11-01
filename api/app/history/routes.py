from flask import Blueprint, request
from sqlalchemy import select
from sqlalchemy.orm import lazyload

from app.auth.session import user_or_404
from app.http import page_arg, paginate, parse_kind
from app.kinds import RATING_TARGETS
from app.models import Rating
from app.ratings.entries import rating_entry

bp = Blueprint("history", __name__, url_prefix="/api")


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
    return paginate(query, rating_entry, page_arg())
