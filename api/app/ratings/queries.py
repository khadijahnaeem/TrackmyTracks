from collections.abc import Iterable

from sqlalchemy import and_, func, select

from app.extensions import db
from app.kinds import Kind
from app.models import Rating
from app.views import EFFECTIVE_RATINGS

NO_COMMUNITY = {"stars": None, "count": 0}


def rating_summaries(user_id: int | None, kind: Kind, target_ids: Iterable[int]) -> dict[int, dict]:
    ids = list(target_ids)
    mine = _mine(user_id, kind, ids) if user_id is not None else {}
    community = _community(kind, ids)
    return {
        target_id: {
            "mine": mine.get(target_id),
            "community": community.get(target_id, NO_COMMUNITY),
        }
        for target_id in ids
    }


def _mine(user_id: int, kind: Kind, ids: list[int]) -> dict[int, dict]:
    view = EFFECTIVE_RATINGS[kind]
    explicit = and_(
        Rating.user_id == view.c.user_id, getattr(Rating, f"{kind}_id") == view.c.target_id
    )
    rows = db.session.execute(
        select(view.c.target_id, view.c.stars, view.c.is_derived, view.c.song_count, Rating.review)
        .select_from(view)
        .outerjoin(Rating, explicit)
        .where(view.c.user_id == user_id, view.c.target_id.in_(ids))
    )
    return {
        row.target_id: {
            "stars": float(row.stars),
            "is_derived": row.is_derived,
            "song_count": row.song_count,
            "review": row.review,
        }
        for row in rows
    }


def _community(kind: Kind, ids: list[int]) -> dict[int, dict]:
    view = EFFECTIVE_RATINGS[kind]
    rows = db.session.execute(
        select(
            view.c.target_id,
            func.round(func.avg(view.c.stars), 1).label("stars"),
            func.count().label("count"),
        )
        .where(view.c.target_id.in_(ids))
        .group_by(view.c.target_id)
    )
    return {row.target_id: {"stars": float(row.stars), "count": row.count} for row in rows}
