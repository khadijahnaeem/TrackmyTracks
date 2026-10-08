import json
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures" / "musicbrainz"

RADIOHEAD = "a74b1b7f-71a5-4011-9441-d0b5e4122711"
OK_COMPUTER = "b1392450-e666-3926-a536-22c65f834433"
OK_COMPUTER_RELEASE = "1834eae1-741b-3c03-9ca5-0df3decb43ea"
AIRBAG = "4a7fea2e-545b-4c63-bc9a-9943cc3a29d7"
PARANOID_ANDROID = "9f9cf187-d6f9-437f-9d98-d59cdbd52757"
KARMA_POLICE = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3"


def load_fixture(name: str):
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))
