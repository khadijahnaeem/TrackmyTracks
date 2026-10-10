import uuid

from flask import Blueprint
from sqlalchemy import select

from app.auth.session import current_user, require_user
from app.catalog.service import get_or_cache_song
from app.errors import Conflict, NotFound, ValidationError
from app.extensions import db
from app.http import json_body, optional_text, required_text
from app.models import Playlist, PlaylistSong, User
from app.playlists.service import (
    owned_playlist_or_404,
    playlist_detail,
    playlist_payload,
    renumber,
    song_counts,
    touch,
    visible_playlist_or_404,
)

bp = Blueprint("playlists", __name__, url_prefix="/api")
MAX_SONGS = 500


def _fields(data: dict, partial: bool) -> dict:
    fields = {}
    if not partial or "name" in data:
        fields["name"] = required_text(data, "name", 100)
    if "description" in data:
        fields["description"] = optional_text(data, "description", 500)
    if "is_public" in data:
        if not isinstance(data["is_public"], bool):
            raise ValidationError("Visibility must be true or false")
        fields["is_public"] = data["is_public"]
    return fields


def _mbid(data: dict) -> str:
    try:
        return str(uuid.UUID(data.get("mbid")))
    except (TypeError, ValueError, AttributeError):
        raise ValidationError("A valid MusicBrainz ID is required") from None


@bp.get("/users/<username>/playlists")
def user_playlists(username: str):
    owner = db.session.scalar(select(User).filter_by(username=username))
    if owner is None:
        raise NotFound("User not found")
    query = (
        select(Playlist)
        .where(Playlist.user_id == owner.id)
        .order_by(Playlist.updated_at.desc(), Playlist.id.desc())
    )
    viewer = current_user()
    if viewer is None or viewer.id != owner.id:
        query = query.where(Playlist.is_public)
    playlists = db.session.scalars(query).all()
    counts = song_counts([playlist.id for playlist in playlists])
    return {"items": [playlist_payload(p, counts.get(p.id, 0)) for p in playlists]}


@bp.post("/playlists")
def create_playlist():
    user = require_user()
    playlist = Playlist(owner=user, **_fields(json_body(), partial=False))
    db.session.add(playlist)
    db.session.commit()
    return playlist_payload(playlist, 0), 201


@bp.get("/playlists/<int:playlist_id>")
def get_playlist(playlist_id: int):
    return playlist_detail(visible_playlist_or_404(playlist_id, current_user()))


@bp.patch("/playlists/<int:playlist_id>")
def update_playlist(playlist_id: int):
    playlist = owned_playlist_or_404(playlist_id, require_user())
    for name, value in _fields(json_body(), partial=True).items():
        setattr(playlist, name, value)
    db.session.commit()
    return playlist_payload(playlist, len(playlist.entries))


@bp.delete("/playlists/<int:playlist_id>")
def delete_playlist(playlist_id: int):
    db.session.delete(owned_playlist_or_404(playlist_id, require_user()))
    db.session.commit()
    return "", 204


@bp.post("/playlists/<int:playlist_id>/songs")
def add_song(playlist_id: int):
    user = require_user()
    mbid = _mbid(json_body())
    owned_playlist_or_404(playlist_id, user)
    song = get_or_cache_song(mbid)
    # caching commits, so the row lock is taken after it
    playlist = owned_playlist_or_404(playlist_id, user, lock=True)
    if any(entry.song_id == song.id for entry in playlist.entries):
        raise Conflict("Song is already in this playlist")
    if len(playlist.entries) >= MAX_SONGS:
        raise ValidationError(f"Playlists hold up to {MAX_SONGS} songs")
    playlist.entries.append(PlaylistSong(song=song, position=len(playlist.entries) + 1))
    touch(playlist)
    db.session.commit()
    return playlist_detail(playlist), 201


@bp.delete("/playlists/<int:playlist_id>/songs/<uuid:mbid>")
def remove_song(playlist_id: int, mbid: uuid.UUID):
    playlist = owned_playlist_or_404(playlist_id, require_user(), lock=True)
    entry = next((e for e in playlist.entries if e.song.mbid == str(mbid)), None)
    if entry is None:
        raise NotFound("Song is not in this playlist")
    playlist.entries.remove(entry)
    renumber(playlist.entries)
    touch(playlist)
    db.session.commit()
    return playlist_detail(playlist)


@bp.put("/playlists/<int:playlist_id>/songs")
def reorder_songs(playlist_id: int):
    user = require_user()
    mbids = json_body().get("mbids")
    if not isinstance(mbids, list) or not all(isinstance(mbid, str) for mbid in mbids):
        raise ValidationError("Mbids must be a list of MusicBrainz IDs")
    playlist = owned_playlist_or_404(playlist_id, user, lock=True)
    by_mbid = {entry.song.mbid: entry for entry in playlist.entries}
    if len(mbids) != len(by_mbid) or set(mbids) != set(by_mbid):
        raise ValidationError("Reorder must list every song in the playlist exactly once")
    renumber([by_mbid[mbid] for mbid in mbids])
    touch(playlist)
    db.session.commit()
    return playlist_detail(playlist)
