from typing import Literal, get_args

from app.models import Album, Artist, Song

Kind = Literal["song", "album", "artist"]
KINDS: tuple[Kind, ...] = get_args(Kind)
MODELS: dict[Kind, type[Song | Album | Artist]] = {"song": Song, "album": Album, "artist": Artist}


def kind_of(entity: Song | Album | Artist) -> Kind:
    return next(kind for kind, model in MODELS.items() if isinstance(entity, model))
