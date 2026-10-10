from sqlalchemy import func, select

from app.auth.serializers import public_user
from app.catalog.serializers import song_summary
from app.errors import NotFound
from app.extensions import db
from app.models import Playlist, PlaylistSong, User


def _owns(user: User | None, playlist: Playlist) -> bool:
    return user is not None and user.id == playlist.user_id


def visible_playlist_or_404(playlist_id: int, viewer: User | None) -> Playlist:
    playlist = db.session.get(Playlist, playlist_id)
    if playlist is None or not (playlist.is_public or _owns(viewer, playlist)):
        raise NotFound("Playlist not found")
    return playlist


def owned_playlist_or_404(playlist_id: int, user: User, lock: bool = False) -> Playlist:
    # lock only the playlist row, owner is a joined load and FOR UPDATE rejects its outer join
    lock_scope = {"of": Playlist} if lock else None
    playlist = db.session.get(
        Playlist, playlist_id, with_for_update=lock_scope, populate_existing=lock
    )
    if playlist is None or not _owns(user, playlist):
        raise NotFound("Playlist not found")
    return playlist


def song_counts(playlist_ids: list[int]) -> dict[int, int]:
    rows = db.session.execute(
        select(PlaylistSong.playlist_id, func.count())
        .where(PlaylistSong.playlist_id.in_(playlist_ids))
        .group_by(PlaylistSong.playlist_id)
    )
    return dict(rows.all())


def renumber(entries: list[PlaylistSong]) -> None:
    for position, entry in enumerate(entries, 1):
        entry.position = position


def touch(playlist: Playlist) -> None:
    playlist.updated_at = func.clock_timestamp()


def playlist_payload(playlist: Playlist, song_count: int) -> dict:
    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": playlist.description,
        "is_public": playlist.is_public,
        "owner": public_user(playlist.owner),
        "song_count": song_count,
        "updated_at": playlist.updated_at.isoformat(),
    }


def playlist_detail(playlist: Playlist) -> dict:
    songs = [song_summary(entry.song) for entry in playlist.entries]
    return {**playlist_payload(playlist, len(songs)), "songs": songs}
