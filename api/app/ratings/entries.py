from app.catalog.serializers import SUMMARIES
from app.kinds import kind_of
from app.models import Rating
from app.ratings.service import rating_fields


def rating_entry(rating: Rating) -> dict:
    target = rating.song or rating.album or rating.artist
    kind = kind_of(target)
    return {**rating_fields(rating), "kind": kind, "item": SUMMARIES[kind](target)}
