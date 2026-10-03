import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from dotenv import load_dotenv
from flask_migrate import upgrade
from sqlalchemy import text
from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.kinds import kind_of
from app.models import Album, AlbumSong, Artist, Rating, Song, User

load_dotenv(Path(__file__).resolve().parents[2] / ".env")
MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"


@pytest.fixture(scope="session")
def app():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": os.environ["TEST_DATABASE_URL"]})
    with app.app_context():
        db.session.execute(text("DROP SCHEMA public CASCADE"))
        db.session.execute(text("CREATE SCHEMA public"))
        db.session.commit()
        upgrade(directory=str(MIGRATIONS))
    return app


# requests inside a test share this context, so tests see the same session as routes
@pytest.fixture(autouse=True)
def _app_context(app):
    with app.app_context():
        yield
        db.session.rollback()
        tables = ", ".join(table.name for table in db.metadata.sorted_tables)
        db.session.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        db.session.commit()


@pytest.fixture
def client(app):
    return app.test_client()


def _save(entity):
    db.session.add(entity)
    db.session.commit()
    return entity


def _mbid() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def make_user():
    def make(username="alice", password="password123") -> User:
        return _save(
            User(
                email=f"{username}@example.com",
                username=username,
                password_hash=generate_password_hash(password),
            )
        )

    return make


@pytest.fixture
def login(client):
    def log_in(user: User) -> None:
        with client.session_transaction() as session:
            session["user_id"] = user.id

    return log_in


@pytest.fixture
def make_artist():
    def make(name="Radiohead") -> Artist:
        return _save(Artist(mbid=_mbid(), name=name, fetched_at=datetime.now(UTC)))

    return make


@pytest.fixture
def make_song():
    def make(artist: Artist, title="Airbag") -> Song:
        return _save(Song(mbid=_mbid(), title=title, artist=artist))

    return make


@pytest.fixture
def make_album():
    def make(artist: Artist, title="OK Computer", songs=()) -> Album:
        tracks = [AlbumSong(song=song, position=i) for i, song in enumerate(songs, 1)]
        return _save(
            Album(
                mbid=_mbid(),
                title=title,
                artist=artist,
                fetched_at=datetime.now(UTC),
                tracks=tracks,
            )
        )

    return make


@pytest.fixture
def rate():
    def make(user: User, entity, stars: float, review: str | None = None) -> Rating:
        target = {kind_of(entity): entity}
        return _save(Rating(user=user, score=int(stars * 2), review=review, **target))

    return make
