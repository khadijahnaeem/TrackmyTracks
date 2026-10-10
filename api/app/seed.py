from collections.abc import Iterable

import click
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from werkzeug.security import generate_password_hash

from app.catalog.service import get_or_cache_album, get_or_cache_artist
from app.errors import CatalogUnavailable
from app.extensions import db
from app.models import Album, Playlist, PlaylistSong, Rating, User

# artist and album pairs, Radiohead, Portishead, Daft Punk, Bjork
CATALOG = (
    ("a74b1b7f-71a5-4011-9441-d0b5e4122711", "b1392450-e666-3926-a536-22c65f834433"),
    ("8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11", "48140466-cff6-3222-bd55-63c27e43190d"),
    ("056e4f3e-d505-4dad-8ec1-d04f521cbb56", "48117b90-a16e-34ca-a514-19c702df1158"),
    ("87c5dedd-371d-4a53-9f7f-80522fb7f3cb", "810272e0-aef1-3d85-b2d3-e512e87fc38c"),
)
DEMO_USERS = ("alex", "sam", "jordan")
DEMO_PASSWORD = "listen-demo"
# shifts each user's scores so personal and community averages differ
TASTE = {"alex": 0, "sam": 2, "jordan": 4}
REVIEWS = {
    "alex": (
        "Every track earns its place. The sequencing alone makes it worth a front to back listen."
    ),
    "sam": (
        "Took a few listens to click, now it is the one I put on "
        "when friends ask for something new."
    ),
}


def seed(catalog: Iterable[tuple[str, str]]) -> dict[str, int]:
    albums: list[Album] = []
    for artist_mbid, album_mbid in catalog:
        get_or_cache_artist(artist_mbid)
        albums.append(get_or_cache_album(album_mbid))

    tracks = [track for album in albums for track in album.tracks]
    users = [_demo_user(name) for name in DEMO_USERS]
    for user in users:
        for track in tracks:
            score = 5 + (track.position * 7 + TASTE[user.username]) % 6
            _rate(user, "song", track.song_id, score)
        if user.username in REVIEWS:
            _rate(user, "album", albums[0].id, 9, REVIEWS[user.username])
    _demo_playlist(users[0], albums)
    db.session.commit()
    return {"artists": len(catalog), "albums": len(albums), "users": len(users)}


def _demo_user(username: str) -> User:
    db.session.execute(
        insert(User)
        .values(
            email=f"{username}@example.com",
            username=username,
            password_hash=generate_password_hash(DEMO_PASSWORD),
        )
        .on_conflict_do_nothing()
    )
    return db.session.scalar(select(User).filter_by(username=username))


def _rate(user: User, kind: str, target_id: int, score: int, review: str | None = None) -> None:
    db.session.execute(
        insert(Rating)
        .values(user_id=user.id, score=score, review=review, **{f"{kind}_id": target_id})
        .on_conflict_do_nothing()
    )


def _demo_playlist(owner: User, albums: list[Album]) -> None:
    name = "Late night listening"
    if db.session.scalar(select(Playlist).filter_by(owner=owner, name=name)):
        return
    openers = [track.song for album in albums for track in album.tracks[:2]]
    db.session.add(
        Playlist(
            owner=owner,
            name=name,
            description="Two openers from every record in the demo catalog.",
            entries=[PlaylistSong(song=song, position=i) for i, song in enumerate(openers, 1)],
        )
    )


@click.command("seed")
def seed_command() -> None:
    """Cache the demo catalog and create demo users"""
    click.echo("Caching the demo catalog from MusicBrainz, this takes about half a minute")
    try:
        result = seed(CATALOG)
    except CatalogUnavailable as error:
        raise click.ClickException(error.message) from error
    click.echo(f"Seeded {result['artists']} artists, {result['albums']} albums, demo users:")
    for username in DEMO_USERS:
        click.echo(f"  {username}@example.com / {DEMO_PASSWORD}")
