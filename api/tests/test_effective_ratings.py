import pytest

from app.extensions import db
from app.ratings.queries import rating_summaries


@pytest.fixture
def album_setup(make_user, make_artist, make_song, make_album):
    artist = make_artist()
    songs = [make_song(artist, title) for title in ("Airbag", "Lucky", "Karma Police")]
    album = make_album(artist, songs=songs)
    return make_user(), artist, album, songs


def _mine(user, kind, entity):
    return rating_summaries(user.id, kind, [entity.id])[entity.id]["mine"]


def test_song_rating_is_mine_and_explicit(make_user, make_artist, make_song, rate):
    user, song = make_user(), make_song(make_artist())
    rate(user, song, 3.5, review="Great opener")

    assert _mine(user, "song", song) == {
        "stars": 3.5,
        "is_derived": False,
        "song_count": 0,
        "review": "Great opener",
    }


def test_album_averages_song_ratings_to_one_decimal(album_setup, rate):
    user, _, album, songs = album_setup
    for song, stars in zip(songs, (3.5, 4, 3.5), strict=True):
        rate(user, song, stars)

    assert _mine(user, "album", album) == {
        "stars": 3.7,
        "is_derived": True,
        "song_count": 3,
        "review": None,
    }


def test_album_override_wins_and_clearing_restores_average(album_setup, rate):
    user, _, album, songs = album_setup
    for song, stars in zip(songs, (3.5, 4, 3.5), strict=True):
        rate(user, song, stars)
    override = rate(user, album, 4.5, review="Better as a whole")

    assert _mine(user, "album", album) == {
        "stars": 4.5,
        "is_derived": False,
        "song_count": 3,
        "review": "Better as a whole",
    }

    db.session.delete(override)
    db.session.commit()

    assert _mine(user, "album", album)["stars"] == 3.7
    assert _mine(user, "album", album)["is_derived"] is True


def test_album_ignores_songs_not_on_it(album_setup, make_song, rate):
    user, artist, album, songs = album_setup
    rate(user, songs[0], 2)
    rate(user, make_song(artist, "Creep"), 5)

    assert _mine(user, "album", album)["stars"] == 2.0


def test_artist_averages_all_their_songs(album_setup, make_artist, make_song, rate):
    user, artist, _, songs = album_setup
    rate(user, songs[0], 5)
    rate(user, songs[1], 4)
    rate(user, make_song(make_artist("Portishead"), "Roads"), 1)

    assert _mine(user, "artist", artist)["stars"] == 4.5
    assert _mine(user, "artist", artist)["song_count"] == 2


def test_community_uses_each_users_effective_rating(album_setup, make_user, rate):
    alice, _, album, songs = album_setup
    for song, stars in zip(songs, (3.5, 4, 3.5), strict=True):
        rate(alice, song, stars)
    rate(make_user("bob"), album, 2)

    community = rating_summaries(None, "album", [album.id])[album.id]["community"]

    assert community == {"stars": 2.9, "count": 2}


def test_unrated_target_and_logged_out_user(album_setup):
    _, _, album, _ = album_setup

    assert rating_summaries(None, "album", [album.id]) == {
        album.id: {"mine": None, "community": {"stars": None, "count": 0}}
    }


def test_batches_many_targets(album_setup, rate):
    user, _, _, songs = album_setup
    rate(user, songs[1], 1)

    summaries = rating_summaries(user.id, "song", [song.id for song in songs])

    assert [summaries[song.id]["mine"] is not None for song in songs] == [False, True, False]
