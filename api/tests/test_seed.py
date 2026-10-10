from sqlalchemy import func, select

from app.extensions import db
from app.models import Playlist, Rating, User
from app.ratings.queries import rating_summaries
from app.seed import DEMO_USERS, seed
from tests.fakes import OK_COMPUTER, RADIOHEAD

CATALOG = ((RADIOHEAD, OK_COMPUTER),)


def _count(model) -> int:
    return db.session.scalar(select(func.count()).select_from(model))


def test_seed_creates_users_ratings_and_a_playlist():
    result = seed(CATALOG)

    assert result == {"artists": 1, "albums": 1, "users": 3}
    assert sorted(db.session.scalars(select(User.username))) == sorted(DEMO_USERS)
    assert _count(Playlist) == 1


def test_seed_makes_community_differ_from_each_user():
    seed(CATALOG)
    album_id = db.session.scalar(select(Rating.album_id).where(Rating.album_id.is_not(None)))
    alex = db.session.scalar(select(User).filter_by(username="alex"))

    summary = rating_summaries(alex.id, "album", [album_id])[album_id]

    assert summary["community"]["count"] == 3
    assert summary["mine"]["stars"] != summary["community"]["stars"]


def test_seed_is_idempotent():
    seed(CATALOG)
    counts = (_count(User), _count(Rating), _count(Playlist))

    seed(CATALOG)

    assert (_count(User), _count(Rating), _count(Playlist)) == counts


def test_seed_cli_reports_demo_login(app, monkeypatch):
    monkeypatch.setattr("app.seed.CATALOG", CATALOG)

    result = app.test_cli_runner().invoke(args=["seed"])

    assert result.exit_code == 0
    assert "alex@example.com" in result.output
