from sqlalchemy import Boolean, Column, Integer, MetaData, Numeric, Table

from app.kinds import KINDS, Kind

# separate metadata so migrations never try to create the views as tables
_views = MetaData()


def _effective_view(kind: Kind) -> Table:
    return Table(
        f"{kind}_effective_ratings",
        _views,
        Column("user_id", Integer),
        Column("target_id", Integer),
        Column("stars", Numeric(2, 1)),
        Column("is_derived", Boolean),
        Column("song_count", Integer),
    )


EFFECTIVE_RATINGS: dict[Kind, Table] = {kind: _effective_view(kind) for kind in KINDS}
