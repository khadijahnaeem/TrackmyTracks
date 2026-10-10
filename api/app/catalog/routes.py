from flask import Blueprint, request

from app.catalog.serializers import SUMMARIES
from app.errors import ValidationError
from app.http import page_arg, page_payload, required_text
from app.kinds import KINDS
from app.musicbrainz import SEARCH_PAGE_SIZE, musicbrainz

bp = Blueprint("catalog", __name__, url_prefix="/api")

MAX_QUERY_LENGTH = 200


@bp.get("/search")
def search():
    kind = request.args.get("type")
    if kind not in KINDS:
        raise ValidationError("Type must be song, album, or artist")
    query = required_text({"query": request.args.get("q")}, "query", MAX_QUERY_LENGTH)
    page = page_arg()

    client = musicbrainz()
    searches = {
        "song": client.search_songs,
        "album": client.search_albums,
        "artist": client.search_artists,
    }
    results = searches[kind](query, page)
    items = [SUMMARIES[kind](item) for item in results.items]
    return page_payload(items, page, results.total, SEARCH_PAGE_SIZE)
