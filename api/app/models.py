from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    username: Mapped[str] = mapped_column(String(30), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Artist(db.Model):
    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(primary_key=True)
    mbid: Mapped[str] = mapped_column(String(36), unique=True)
    name: Mapped[str] = mapped_column(String(500))
    # set once discography and top songs are cached
    fetched_at: Mapped[datetime | None]

    top_songs: Mapped[list["ArtistTopSong"]] = relationship(order_by="ArtistTopSong.rank")


class Song(db.Model):
    __tablename__ = "songs"

    id: Mapped[int] = mapped_column(primary_key=True)
    mbid: Mapped[str] = mapped_column(String(36), unique=True)
    title: Mapped[str] = mapped_column(String(500))
    disambiguation: Mapped[str | None] = mapped_column(String(500))
    length_ms: Mapped[int | None]
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), index=True)

    artist: Mapped[Artist] = relationship(lazy="joined")


class Album(db.Model):
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(primary_key=True)
    mbid: Mapped[str] = mapped_column(String(36), unique=True)
    title: Mapped[str] = mapped_column(String(500))
    release_year: Mapped[int | None]
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), index=True)
    # set once the tracklist is cached
    fetched_at: Mapped[datetime | None]

    artist: Mapped[Artist] = relationship(lazy="joined")
    tracks: Mapped[list["AlbumSong"]] = relationship(order_by="AlbumSong.position")


class AlbumSong(db.Model):
    __tablename__ = "album_songs"

    album_id: Mapped[int] = mapped_column(
        ForeignKey("albums.id", ondelete="CASCADE"), primary_key=True
    )
    song_id: Mapped[int] = mapped_column(
        ForeignKey("songs.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    position: Mapped[int]

    song: Mapped[Song] = relationship(lazy="joined")


class ArtistTopSong(db.Model):
    __tablename__ = "artist_top_songs"

    artist_id: Mapped[int] = mapped_column(
        ForeignKey("artists.id", ondelete="CASCADE"), primary_key=True
    )
    rank: Mapped[int] = mapped_column(primary_key=True)
    song_id: Mapped[int] = mapped_column(ForeignKey("songs.id", ondelete="CASCADE"))

    song: Mapped[Song] = relationship(lazy="joined")


class Rating(db.Model):
    __tablename__ = "ratings"
    __table_args__ = (
        CheckConstraint("num_nonnulls(song_id, album_id, artist_id) = 1", name="one_target"),
        CheckConstraint("score BETWEEN 1 AND 10", name="score_range"),
        CheckConstraint("review <> ''", name="review_not_blank"),
        UniqueConstraint("user_id", "song_id"),
        UniqueConstraint("user_id", "album_id"),
        UniqueConstraint("user_id", "artist_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    song_id: Mapped[int | None] = mapped_column(ForeignKey("songs.id"), index=True)
    album_id: Mapped[int | None] = mapped_column(ForeignKey("albums.id"), index=True)
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"), index=True)
    # half stars, 1 is 0.5 stars and 10 is 5 stars
    score: Mapped[int] = mapped_column(SmallInteger)
    review: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(lazy="joined")
    song: Mapped[Song | None] = relationship(lazy="joined")
    album: Mapped[Album | None] = relationship(lazy="joined")
    artist: Mapped[Artist | None] = relationship(lazy="joined")


class Playlist(db.Model):
    __tablename__ = "playlists"
    __table_args__ = (
        CheckConstraint("name <> ''", name="name_not_blank"),
        CheckConstraint("description <> ''", name="description_not_blank"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500))
    is_public: Mapped[bool] = mapped_column(default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    owner: Mapped[User] = relationship(lazy="joined")
    entries: Mapped[list["PlaylistSong"]] = relationship(
        order_by="PlaylistSong.position", cascade="all, delete-orphan"
    )


class PlaylistSong(db.Model):
    __tablename__ = "playlist_songs"
    # deferred so a reorder can swap positions inside one transaction
    __table_args__ = (
        UniqueConstraint("playlist_id", "position", deferrable=True, initially="DEFERRED"),
    )

    playlist_id: Mapped[int] = mapped_column(
        ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True
    )
    song_id: Mapped[int] = mapped_column(ForeignKey("songs.id"), primary_key=True)
    position: Mapped[int]
    added_at: Mapped[datetime] = mapped_column(server_default=func.now())

    song: Mapped[Song] = relationship(lazy="joined")
