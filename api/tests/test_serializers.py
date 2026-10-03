from app.catalog.serializers import SUMMARIES, album_summary, song_summary


def test_song_summary_nests_artist(make_artist, make_song):
    artist = make_artist()
    song = make_song(artist, "Airbag")
    song.length_ms = 284400

    assert song_summary(song) == {
        "mbid": song.mbid,
        "title": "Airbag",
        "disambiguation": None,
        "length_ms": 284400,
        "artist": {"mbid": artist.mbid, "name": "Radiohead"},
    }


def test_album_summary_nests_artist(make_artist, make_album):
    album = make_album(make_artist())
    album.release_year = 1997

    assert album_summary(album) == {
        "mbid": album.mbid,
        "title": "OK Computer",
        "release_year": 1997,
        "artist": {"mbid": album.artist.mbid, "name": "Radiohead"},
    }


def test_summaries_cover_every_kind(make_artist):
    artist = make_artist()

    assert SUMMARIES["artist"](artist) == {"mbid": artist.mbid, "name": "Radiohead"}
    assert set(SUMMARIES) == {"song", "album", "artist"}
