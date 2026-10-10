import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert

from app.auth.serializers import public_user
from app.catalog.service import find_cached, get_or_cache
from app.errors import NotFound, ValidationError
from app.extensions import db
from app.http import PER_PAGE, page_payload, paginate
from app.kinds import KINDS, Kind
from app.models import Album, Artist, Rating, Song, User
from app.ratings.queries import rating_summaries

REVIEW_MAX_LENGTH = 2000


def parse_kind(value) -> Kind:
    if value not in KINDS:
        raise ValidationError("Kind must be song, album, or artist")
    return value


def parse_mbid(value) -> str:
    try:
        return str(uuid.UUID(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise ValidationError("Mbid must be a MusicBrainz ID") from error


def parse_stars(value) -> int:
    valid = (
        isinstance(value, int | float)
        and not isinstance(value, bool)
        and 0.5 <= value <= 5
        and float(value * 2).is_integer()
    )
    if not valid:
        raise ValidationError("Stars must be 0.5 to 5 in half star steps")
    return int(value * 2)


def save_rating(user: User, kind: Kind, mbid: str, changes: dict) -> dict:
    entity = get_or_cache(kind, mbid)
    target = f"{kind}_id"
    statement = insert(Rating).values(user_id=user.id, **{target: entity.id}, **changes)
    db.session.execute(
        statement.on_conflict_do_update(
            index_elements=["user_id", target], set_={**changes, "updated_at": func.now()}
        )
    )
    db.session.commit()
    return _rating_payload(user, kind, entity)


def clear_rating(user: User, kind: Kind, mbid: str) -> dict:
    entity = find_cached(kind, mbid)
    if entity is None:
        raise NotFound(f"{kind.capitalize()} not found")
    target = getattr(Rating, f"{kind}_id")
    db.session.execute(delete(Rating).where(Rating.user_id == user.id, target == entity.id))
    db.session.commit()
    return _rating_payload(user, kind, entity)


def _rating_payload(user: User, kind: Kind, entity: Song | Album | Artist) -> dict:
    return {"mbid": entity.mbid, "rating": rating_summaries(user.id, kind, [entity.id])[entity.id]}


def reviews_page(kind: Kind, mbid: str, page: int) -> dict:
    entity = find_cached(kind, mbid)
    if entity is None:
        return page_payload([], page, 0, PER_PAGE)
    query = (
        select(Rating)
        .where(getattr(Rating, f"{kind}_id") == entity.id, Rating.review.is_not(None))
        .order_by(Rating.updated_at.desc(), Rating.id.desc())
    )
    return paginate(query, review_payload, page)


def review_payload(rating: Rating) -> dict:
    return {
        "id": rating.id,
        "user": public_user(rating.user),
        "stars": rating.score / 2,
        "review": rating.review,
        "updated_at": rating.updated_at.isoformat(),
    }
