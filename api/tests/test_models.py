import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Playlist, PlaylistSong, Rating


@pytest.fixture
def song(make_artist, make_song):
    return make_song(make_artist())


def _commit_fails(entity):
    db.session.add(entity)
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_rating_needs_exactly_one_target(make_user, song, make_album):
    album = make_album(song.artist)
    _commit_fails(Rating(user=make_user(), song=song, album=album, score=6))


def test_rating_score_is_half_stars_one_to_ten(make_user, song):
    _commit_fails(Rating(user=make_user(), song=song, score=11))


def test_rating_review_cannot_be_blank(make_user, song):
    _commit_fails(Rating(user=make_user(), song=song, score=6, review=""))


def test_one_rating_per_user_per_target(make_user, song, rate):
    user = make_user()
    rate(user, song, 3)
    _commit_fails(Rating(user=user, song=song, score=8))


def test_playlist_positions_can_swap_in_one_transaction(make_user, make_artist, make_song):
    artist = make_artist()
    first, second = make_song(artist, "Airbag"), make_song(artist, "Lucky")
    playlist = Playlist(
        owner=make_user(),
        name="Mix",
        entries=[PlaylistSong(song=first, position=1), PlaylistSong(song=second, position=2)],
    )
    db.session.add(playlist)
    db.session.commit()

    playlist.entries[0].position, playlist.entries[1].position = 2, 1
    db.session.commit()

    assert [entry.song.title for entry in playlist.entries] == ["Lucky", "Airbag"]
