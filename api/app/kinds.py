from typing import Literal, get_args

from sqlalchemy.orm import InstrumentedAttribute

from app.models import Album, Artist, Rating, Song

Kind = Literal["song", "album", "artist"]
KINDS: tuple[Kind, ...] = get_args(Kind)
MODELS: dict[Kind, type[Song | Album | Artist]] = {"song": Song, "album": Album, "artist": Artist}
# the ratings column that points at each kind
RATING_TARGETS: dict[Kind, InstrumentedAttribute[int | None]] = {
    "song": Rating.song_id,
    "album": Rating.album_id,
    "artist": Rating.artist_id,
}


def kind_of(entity: Song | Album | Artist) -> Kind:
    return next(kind for kind, model in MODELS.items() if isinstance(entity, model))
