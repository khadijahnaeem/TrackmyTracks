import pytest
import requests
import responses

from app.errors import CatalogUnavailable, NotFound
from app.musicbrainz import LB_ROOT, MB_ROOT, ArtistData, MusicBrainzClient
from tests.fakes import (
    KARMA_POLICE,
    OK_COMPUTER,
    OK_COMPUTER_RELEASE,
    RADIOHEAD,
    load_fixture,
)

RADIOHEAD_DATA = ArtistData(RADIOHEAD, "Radiohead")


@pytest.fixture
def mb(monkeypatch):
    monkeypatch.setattr("app.musicbrainz.time.sleep", lambda seconds: None)
    return MusicBrainzClient("TrackmyTracks/test ( tests )")


@pytest.fixture
def api():
    with responses.RequestsMock() as mock:
        yield mock


def test_get_artist_sends_user_agent(mb, api):
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", json=load_fixture("artist"))

    assert mb.get_artist(RADIOHEAD) == RADIOHEAD_DATA
    assert api.calls[0].request.headers["User-Agent"] == "TrackmyTracks/test ( tests )"


def test_artist_albums_skip_live_and_sort_newest_first(mb, api):
    api.get(f"{MB_ROOT}/release-group", json=load_fixture("artist-albums"))

    albums = mb.get_artist_albums(RADIOHEAD)

    assert [(a.title, a.release_year) for a in albums] == [
        ("In Rainbows", 2007),
        ("Hail to the Thief", 2003),
    ]


def test_album_uses_earliest_official_release(mb, api):
    api.get(f"{MB_ROOT}/release-group/{OK_COMPUTER}", json=load_fixture("release-group"))
    api.get(f"{MB_ROOT}/release/{OK_COMPUTER_RELEASE}", json=load_fixture("release"))

    detail = mb.get_album(OK_COMPUTER)

    assert (detail.album.title, detail.album.release_year) == ("OK Computer", 1997)
    assert detail.album.artist == RADIOHEAD_DATA
    assert [song.title for song in detail.tracks] == [
        "Airbag",
        "Paranoid Android",
        "Subterranean Homesick Alien",
    ]
    assert detail.tracks[0].length_ms == 284400


def test_get_song_maps_blank_disambiguation_to_none(mb, api):
    api.get(f"{MB_ROOT}/recording/{KARMA_POLICE}", json=load_fixture("recording"))

    song = mb.get_song(KARMA_POLICE)

    assert (song.title, song.disambiguation, song.length_ms) == ("Karma Police", None, 262426)
    assert song.artist == RADIOHEAD_DATA


def test_top_songs_keeps_first_five_for_the_artist(mb, api):
    url = f"{LB_ROOT}/popularity/top-recordings-for-artist/{RADIOHEAD}"
    api.get(url, json=load_fixture("top-recordings"))

    songs = mb.top_songs(RADIOHEAD_DATA)

    assert [song.title for song in songs] == [
        "Karma Police",
        "Paranoid Android",
        "No Surprises",
        "All I Need",
        "Creep",
    ]
    assert {song.artist for song in songs} == {RADIOHEAD_DATA}


def test_top_songs_is_empty_without_listening_data(mb, api):
    api.get(f"{LB_ROOT}/popularity/top-recordings-for-artist/{RADIOHEAD}", status=404)

    assert mb.top_songs(RADIOHEAD_DATA) == []


def test_requests_are_spaced_one_second_apart(monkeypatch, api):
    sleeps = []
    monkeypatch.setattr("app.musicbrainz.time.sleep", sleeps.append)
    mb = MusicBrainzClient("TrackmyTracks/test")
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", json=load_fixture("artist"))

    mb.get_artist(RADIOHEAD)
    mb.get_artist(RADIOHEAD)

    assert len(sleeps) == 1
    assert 0.9 < sleeps[0] <= 1.0


@pytest.mark.parametrize("status", [400, 404])
def test_bad_or_unknown_mbid_is_not_found(mb, api, status):
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", status=status)

    with pytest.raises(NotFound):
        mb.get_artist(RADIOHEAD)


def test_rate_limit_or_outage_is_unavailable(mb, api):
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", status=503)

    with pytest.raises(CatalogUnavailable):
        mb.get_artist(RADIOHEAD)


def test_network_failure_is_unavailable(mb, api):
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", body=requests.ConnectionError())

    with pytest.raises(CatalogUnavailable):
        mb.get_artist(RADIOHEAD)
