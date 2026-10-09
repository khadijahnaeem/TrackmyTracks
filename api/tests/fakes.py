import json
from pathlib import Path

from app.errors import CatalogUnavailable, NotFound
from app.musicbrainz import LB_ROOT, MB_ROOT, UNAVAILABLE, MusicBrainzClient

FIXTURES = Path(__file__).parent / "fixtures" / "musicbrainz"

RADIOHEAD = "a74b1b7f-71a5-4011-9441-d0b5e4122711"
OK_COMPUTER = "b1392450-e666-3926-a536-22c65f834433"
OK_COMPUTER_RELEASE = "1834eae1-741b-3c03-9ca5-0df3decb43ea"
AIRBAG = "4a7fea2e-545b-4c63-bc9a-9943cc3a29d7"
PARANOID_ANDROID = "9f9cf187-d6f9-437f-9d98-d59cdbd52757"
KARMA_POLICE = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3"


def load_fixture(name: str):
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


ROUTES = {
    f"/artist/{RADIOHEAD}": "artist",
    "/release-group?artist": "artist-albums",
    f"/release-group/{OK_COMPUTER}": "release-group",
    f"/release/{OK_COMPUTER_RELEASE}": "release",
    f"/recording/{KARMA_POLICE}": "recording",
    "/artist?query": "search-artists",
    "/release-group?query": "search-albums",
    "/recording?query": "search-songs",
    f"/popularity/top-recordings-for-artist/{RADIOHEAD}": "top-recordings",
}


class FakeMusicBrainz(MusicBrainzClient):
    """Real parsing over recorded fixtures with no network or throttle"""

    def __init__(self):
        super().__init__("TrackmyTracks/test", "test-token")
        # any request that skips the fake fails loudly
        self._http = None
        self.calls: list[str] = []
        self.unavailable = False
        self.routes = {path: load_fixture(name) for path, name in ROUTES.items()}

    def _mb(self, path: str, **params) -> dict:
        return self._get(f"{MB_ROOT}{path}", params)

    def _get(self, url: str, params: dict, headers: dict | None = None, stream: bool = False):
        key = url.removeprefix(MB_ROOT).removeprefix(LB_ROOT)
        key += "".join(f"?{name}" for name in ("query", "artist") if name in params)
        self.calls.append(key)
        if self.unavailable:
            raise CatalogUnavailable(UNAVAILABLE)
        if key not in self.routes:
            raise NotFound("Not found in the music catalog")
        route = self.routes[key]
        if isinstance(route, Exception):
            raise route
        return route
