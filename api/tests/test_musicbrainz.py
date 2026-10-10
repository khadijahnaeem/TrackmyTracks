import json
from itertools import islice

import pytest
import requests
import responses
from responses import matchers

from app import create_app
from app.errors import CatalogUnavailable, NotFound
from app.musicbrainz import LB_ROOT, MB_ROOT, ArtistData, MusicBrainzClient, json_array_items
from tests.fakes import (
    KARMA_POLICE,
    OK_COMPUTER,
    OK_COMPUTER_RELEASE,
    RADIOHEAD,
    load_fixture,
)

RADIOHEAD_DATA = ArtistData(RADIOHEAD, "Radiohead")
TOKEN = "test-token"
# the search-artists matches that have listens or recordings, in relevance order
PUBLISHED = [
    "Radiohead",
    "On a Friday",
    "radiohead 3",
    "DJ Radiohead",
    "Radiohead 2",
    "The Smile",
    "Philip Selway",
    "Ed O’Brien",
    "In Rainbows",
    "Colin Greenwood",
    "Amnesiac Quartet",
    "Gazz",
    "Secret Society",
]


@pytest.fixture
def mb(monkeypatch):
    monkeypatch.setattr("app.musicbrainz.time.sleep", lambda seconds: None)
    return MusicBrainzClient("TrackmyTracks/test ( tests )", TOKEN)


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


def test_top_songs_keeps_first_five_credited_first_to_the_artist(mb, api):
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


def test_only_listenbrainz_requests_carry_the_token(mb, api):
    api.get(f"{LB_ROOT}/popularity/top-recordings-for-artist/{RADIOHEAD}", json=[])
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", json=load_fixture("artist"))

    mb.top_songs(RADIOHEAD_DATA)
    mb.get_artist(RADIOHEAD)

    listenbrainz, musicbrainz = (call.request.headers for call in api.calls)
    assert listenbrainz["Authorization"] == f"Token {TOKEN}"
    assert "Authorization" not in musicbrainz


def test_top_songs_skips_rows_without_artist_credits(mb, api):
    rows = load_fixture("top-recordings")
    # karma police loses its credit list and paranoid android has an empty one
    rows[0] = {key: value for key, value in rows[0].items() if key != "artist_mbids"}
    rows[2] = rows[2] | {"artist_mbids": []}
    api.get(f"{LB_ROOT}/popularity/top-recordings-for-artist/{RADIOHEAD}", json=rows)

    songs = mb.top_songs(RADIOHEAD_DATA)

    assert [song.title for song in songs] == ["No Surprises", "All I Need", "Creep", "15 Step"]


def test_top_songs_is_empty_without_listening_data(mb, api):
    api.get(f"{LB_ROOT}/popularity/top-recordings-for-artist/{RADIOHEAD}", status=404)

    assert mb.top_songs(RADIOHEAD_DATA) == []


def test_truncated_top_songs_stream_is_unavailable(mb, api):
    url = f"{LB_ROOT}/popularity/top-recordings-for-artist/{RADIOHEAD}"
    api.get(url, body='[{"artist_mbids": [')

    with pytest.raises(CatalogUnavailable):
        mb.top_songs(RADIOHEAD_DATA)


def test_streamed_rows_parse_across_chunks_and_stop_early():
    def chunks():
        yield b'[{"name": "Sigur R\xc3'
        yield b'\xb3s"}, {"name": "Bj\xc3\xb6rk"},'
        raise AssertionError("read past the rows that were needed")

    rows = json_array_items(chunks())

    assert [row["name"] for row in islice(rows, 2)] == ["Sigur Rós", "Björk"]


def test_album_without_releases_has_no_tracks(mb, api):
    group = {**load_fixture("release-group"), "releases": []}
    api.get(f"{MB_ROOT}/release-group/{OK_COMPUTER}", json=group)

    detail = mb.get_album(OK_COMPUTER)

    assert (detail.album.title, detail.tracks) == ("OK Computer", [])


def test_requests_are_spaced_one_second_apart(monkeypatch, api):
    sleeps = []
    monkeypatch.setattr("app.musicbrainz.time.sleep", sleeps.append)
    mb = MusicBrainzClient("TrackmyTracks/test", TOKEN)
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


def test_non_json_response_is_unavailable(mb, api):
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", body="<html>maintenance</html>")

    with pytest.raises(CatalogUnavailable):
        mb.get_artist(RADIOHEAD)


def test_network_failure_is_unavailable(mb, api):
    api.get(f"{MB_ROOT}/artist/{RADIOHEAD}", body=requests.ConnectionError())

    with pytest.raises(CatalogUnavailable):
        mb.get_artist(RADIOHEAD)


def _recording(mbid: str, title: str, artist: str = "Dom Fera") -> dict:
    credit = {"name": artist, "artist": {"id": RADIOHEAD, "name": artist}}
    return {"id": mbid, "title": title, "artist-credit": [credit]}


def _stub_song_search(api, recordings: list[dict], listens: dict[str, int | None]):
    api.get(f"{MB_ROOT}/recording", json={"count": 99999, "offset": 0, "recordings": recordings})
    api.post(
        f"{LB_ROOT}/popularity/recording",
        json=[{"recording_mbid": mbid, "total_listen_count": n} for mbid, n in listens.items()],
    )


def test_search_songs_puts_recordings_matching_every_word_first(mb, api):
    api.get(
        f"{MB_ROOT}/recording",
        json=load_fixture("search-songs"),
        match=[
            matchers.query_param_matcher(
                {"query": "northern star dom fera", "limit": "100", "fmt": "json"}
            )
        ],
    )
    api.post(f"{LB_ROOT}/popularity/recording", json=load_fixture("recording-popularity"))

    results = mb.search_songs("northern star dom fera", page=1)

    top = [(song.title, song.artist.name) for song in results.items[:3]]
    assert top == [
        ("Northern Star", "Dom Fera"),
        ("Northern Star", "Grand Magus"),
        ("Anybody Else", "Dom Fera"),
    ]
    assert results.total == len(load_fixture("search-songs")["recordings"])


def test_search_songs_breaks_ties_by_listens_then_keeps_musicbrainz_order(mb, api):
    recordings = [
        _recording(f"{n}0000000-0000-4000-8000-000000000000", "Karma Police") for n in range(4)
    ]
    ids = [recording["id"] for recording in recordings]
    _stub_song_search(api, recordings, {ids[0]: None, ids[1]: 5, ids[2]: 900, ids[3]: 0})

    results = mb.search_songs("karma police", page=1)

    assert [song.mbid for song in results.items] == [ids[2], ids[1], ids[0], ids[3]]
    assert [results.listens.get(song.mbid, 0) for song in results.items] == [900, 5, 0, 0]


def test_search_songs_matches_words_across_case_accents_and_disambiguation(mb, api):
    plain = _recording("10000000-0000-4000-8000-000000000000", "Joga")
    accented = _recording("20000000-0000-4000-8000-000000000000", "Jóga", "BJÖRK")
    live = _recording("30000000-0000-4000-8000-000000000000", "Joga", "Björk") | {
        "disambiguation": "live, 1997"
    }
    _stub_song_search(api, [plain, accented, live], {})

    results = mb.search_songs("joga bjork live", page=1)

    assert [song.mbid for song in results.items] == [live["id"], accented["id"], plain["id"]]


def test_search_songs_pages_the_ranked_window(mb, api, monkeypatch):
    monkeypatch.setattr("app.musicbrainz.SEARCH_PAGE_SIZE", 3)
    recordings = [_recording(f"{n}0000000-0000-4000-8000-000000000000", "Lore") for n in range(7)]
    _stub_song_search(api, recordings, {})

    results = mb.search_songs("lore", page=3)

    assert [song.mbid for song in results.items] == [recordings[6]["id"]]
    assert results.total == 7


def test_search_songs_keeps_musicbrainz_order_when_listenbrainz_fails(mb, api):
    recordings = [_recording(f"{n}0000000-0000-4000-8000-000000000000", "Lore") for n in range(3)]
    api.get(f"{MB_ROOT}/recording", json={"count": 3, "offset": 0, "recordings": recordings})
    api.post(f"{LB_ROOT}/popularity/recording", status=503)

    results = mb.search_songs("lore", page=1)

    assert [song.mbid for song in results.items] == [r["id"] for r in recordings]
    assert results.listens == {}


def test_search_songs_without_matches_asks_nothing_else(mb, api):
    api.get(f"{MB_ROOT}/recording", json={"count": 0, "offset": 0, "recordings": []})

    results = mb.search_songs("zzqxjvkwq", page=1)

    assert results.items == []
    assert results.total == 0
    assert len(api.calls) == 1


def test_search_albums_limits_to_albums(mb, api):
    api.get(
        f"{MB_ROOT}/release-group",
        json=load_fixture("search-albums"),
        match=[
            matchers.query_param_matcher(
                {
                    "query": "releasegroup:(ok computer) AND primarytype:album",
                    "limit": "25",
                    "offset": "0",
                    "fmt": "json",
                }
            )
        ],
    )

    results = mb.search_albums("ok computer", page=1)

    assert [album.title for album in results.items] == ["OK Computer", "OK Computer (8-bit)"]


def _stub_published_checks(api):
    api.post(f"{LB_ROOT}/popularity/artist", json=load_fixture("artist-popularity"))
    api.get(f"{MB_ROOT}/recording", json=load_fixture("artist-recordings"))


def test_search_escapes_lucene_syntax(mb, api):
    api.get(
        f"{MB_ROOT}/artist",
        json=load_fixture("search-artists"),
        match=[
            matchers.query_param_matcher(
                {"query": 'AC\\/DC \\"live\\"', "limit": "100", "fmt": "json"}
            )
        ],
    )
    _stub_published_checks(api)

    results = mb.search_artists('AC/DC "live"', page=1)

    assert results.items[0].name == "Radiohead"


def test_search_artists_drops_artists_with_nothing_released(mb, api):
    api.get(f"{MB_ROOT}/artist", json=load_fixture("search-artists"))
    _stub_published_checks(api)

    results = mb.search_artists("radiohead", page=1)

    assert [artist.name for artist in results.items] == PUBLISHED
    assert results.total == len(PUBLISHED)
    listens = {artist.name: results.listens.get(artist.mbid, 0) for artist in results.items}
    # DJ Radiohead has a recording but no listens, so it stays with a zero count
    assert (listens["Radiohead"], listens["DJ Radiohead"]) == (134659628, 0)


def test_search_artists_looks_up_recordings_only_for_unheard_artists(mb, api):
    matches = [artist["id"] for artist in load_fixture("search-artists")["artists"]]
    heard = {
        row["artist_mbid"] for row in load_fixture("artist-popularity") if row["total_listen_count"]
    }
    api.get(f"{MB_ROOT}/artist", json=load_fixture("search-artists"))
    _stub_published_checks(api)

    mb.search_artists("radiohead", page=1)

    popularity, recordings = api.calls[1].request, api.calls[2].request
    assert popularity.headers["Authorization"] == f"Token {TOKEN}"
    assert json.loads(popularity.body) == {"artist_mbids": matches}
    query = recordings.params["query"]
    assert query.startswith("arid:(")
    assert RADIOHEAD not in query
    assert all(mbid in query for mbid in matches if mbid not in heard)


def test_search_artists_pages_after_filtering(mb, api, monkeypatch):
    monkeypatch.setattr("app.musicbrainz.SEARCH_PAGE_SIZE", 5)
    api.get(f"{MB_ROOT}/artist", json=load_fixture("search-artists"))
    _stub_published_checks(api)

    results = mb.search_artists("radiohead", page=2)

    assert [artist.name for artist in results.items] == PUBLISHED[5:10]
    assert results.total == len(PUBLISHED)


def test_search_artists_skips_the_recording_lookup_when_every_match_was_heard(mb, api):
    search = load_fixture("search-artists")
    api.get(f"{MB_ROOT}/artist", json=search)
    api.post(
        f"{LB_ROOT}/popularity/artist",
        json=[
            {"artist_mbid": artist["id"], "total_listen_count": 1} for artist in search["artists"]
        ],
    )

    results = mb.search_artists("radiohead", page=1)

    assert results.total == search["count"]
    assert len(api.calls) == 2


@pytest.mark.parametrize("status", [400, 401, 503])
def test_search_artists_keeps_every_match_when_listenbrainz_fails(mb, api, status):
    search = load_fixture("search-artists")
    api.get(f"{MB_ROOT}/artist", json=search)
    api.post(f"{LB_ROOT}/popularity/artist", status=status)

    results = mb.search_artists("radiohead", page=1)

    assert results.total == len(search["artists"])
    assert results.listens == {}
    # nothing is filtered, so the recording lookup never runs
    assert len(api.calls) == 2


def test_search_artists_without_matches_asks_nothing_else(mb, api):
    api.get(f"{MB_ROOT}/artist", json={"count": 0, "offset": 0, "artists": []})

    results = mb.search_artists("zzqxjvkwq", page=1)

    assert results.items == []
    assert results.total == 0
    assert len(api.calls) == 1


def test_app_carries_a_musicbrainz_client():
    app = create_app()

    assert isinstance(app.extensions["musicbrainz"], MusicBrainzClient)


def _lore_recordings(count: int) -> list[dict]:
    return [_recording(f"{n:08d}-0000-4000-8000-000000000000", "Lore") for n in range(count)]


def test_search_pages_share_one_window(mb, api):
    recordings = _lore_recordings(30)
    _stub_song_search(api, recordings, {})

    first = mb.search_songs("lore", page=1)
    second = mb.search_songs("  LORE ", page=2)

    assert [song.mbid for song in first.items + second.items] == [r["id"] for r in recordings]
    assert len(api.calls) == 2


def test_search_windows_expire(mb, api, monkeypatch):
    monkeypatch.setattr("app.musicbrainz.SEARCH_CACHE_SECONDS", 0)
    _stub_song_search(api, _lore_recordings(3), {})

    mb.search_songs("lore", page=1)
    mb.search_songs("lore", page=1)

    assert len(api.calls) == 4


def test_search_does_not_keep_a_window_ranked_without_listens(mb, api):
    recordings = _lore_recordings(2)
    api.get(f"{MB_ROOT}/recording", json={"count": 2, "offset": 0, "recordings": recordings})
    api.post(f"{LB_ROOT}/popularity/recording", status=503)
    api.post(
        f"{LB_ROOT}/popularity/recording",
        json=[{"recording_mbid": recordings[1]["id"], "total_listen_count": 7}],
    )

    mb.search_songs("lore", page=1)
    results = mb.search_songs("lore", page=1)

    assert results.items[0].mbid == recordings[1]["id"]
    assert len(api.calls) == 4


def test_search_cache_drops_the_oldest_window(mb, api, monkeypatch):
    monkeypatch.setattr("app.musicbrainz.SEARCH_CACHE_SIZE", 1)
    _stub_song_search(api, _lore_recordings(2), {})

    for query in ("lore", "saga", "lore"):
        mb.search_songs(query, page=1)

    assert len(api.calls) == 6
