import pytest

from app.extensions import db
from app.models import Playlist, PlaylistSong


@pytest.fixture
def make_playlist():
    def make(owner, name="Late nights", is_public=True, songs=()) -> Playlist:
        entries = [PlaylistSong(song=song, position=i) for i, song in enumerate(songs, 1)]
        playlist = Playlist(owner=owner, name=name, is_public=is_public, entries=entries)
        db.session.add(playlist)
        db.session.commit()
        return playlist

    return make


@pytest.fixture
def songs(make_artist, make_song):
    artist = make_artist()
    return [make_song(artist, title) for title in ("Airbag", "Lucky", "Let Down")]
