from flask import Blueprint
from sqlalchemy import select

from app.auth.session import current_user, require_user
from app.errors import NotFound, ValidationError
from app.extensions import db
from app.http import json_body, optional_text, required_text
from app.models import Playlist, User
from app.playlists.service import (
    owned_playlist_or_404,
    playlist_detail,
    playlist_payload,
    song_counts,
    visible_playlist_or_404,
)

bp = Blueprint("playlists", __name__, url_prefix="/api")


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
