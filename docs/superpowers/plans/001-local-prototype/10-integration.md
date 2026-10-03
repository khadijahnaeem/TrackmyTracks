# Slice 10 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn nine merged slices into one demoable prototype: seeded data, a verified walkthrough of every spec goal, and a polish pass.

**Architecture:** A `flask seed` command caches four real albums and creates three demo users whose ratings make community averages differ from personal ones. The rest is verification: a scripted walkthrough of the spec's goals and a polish audit with concrete pass criteria.

**Tech Stack:** Flask CLI, click, everything from slices 01 to 09

**Spec:** `docs/superpowers/specs/001-local-prototype-design.md`

**Index:** `docs/superpowers/plans/001-local-prototype.md`. Its Global Constraints and Contracts apply to every task here.

**Branch:** `slice/10-integration`. Requires slices 01 to 09 merged. Task 1 can start once 04 is merged.

---

### Task 1: Seed command

**Files:**
- Create: `api/app/seed.py`
- Modify: `api/app/__init__.py`
- Test: `api/tests/test_seed.py`

**Interfaces:**
- Consumes: `get_or_cache_artist`, `get_or_cache_album`, models
- Produces: `seed(catalog) -> dict[str, int]`, `CATALOG`, `DEMO_USERS`, `DEMO_PASSWORD`, and the `flask seed` CLI command. Running it twice changes nothing the second time.

- [ ] **Step 1: Write the failing tests**

`api/tests/test_seed.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_seed.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.seed'`

- [ ] **Step 3: Write the implementation**

`api/app/seed.py`:

```python
import click
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from werkzeug.security import generate_password_hash

from app.catalog.service import get_or_cache_album, get_or_cache_artist
from app.extensions import db
from app.models import Album, Playlist, PlaylistSong, Rating, User

# artist and album pairs, Radiohead, Portishead, Daft Punk, Bjork
CATALOG = (
    ("a74b1b7f-71a5-4011-9441-d0b5e4122711", "b1392450-e666-3926-a536-22c65f834433"),
    ("8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11", "48140466-cff6-3222-bd55-63c27e43190d"),
    ("056e4f3e-d505-4dad-8ec1-d04f521cbb56", "48117b90-a16e-34ca-a514-19c702df1158"),
    ("87c5dedd-371d-4a53-9f7f-80522fb7f3cb", "810272e0-aef1-3d85-b2d3-e512e87fc38c"),
)
DEMO_USERS = ("alex", "sam", "jordan")
DEMO_PASSWORD = "listen-demo"
# shifts each user's scores so personal and community averages differ
TASTE = {"alex": 0, "sam": 2, "jordan": 4}
REVIEWS = {
    "alex": "Every track earns its place. The sequencing alone makes it worth a front to back listen.",
    "sam": "Took a few listens to click, now it is the one I put on when friends ask for something new.",
}


def seed(catalog) -> dict[str, int]:
    albums: list[Album] = []
    for artist_mbid, album_mbid in catalog:
        get_or_cache_artist(artist_mbid)
        albums.append(get_or_cache_album(album_mbid))

    tracks = [track for album in albums for track in album.tracks]
    users = [_demo_user(name) for name in DEMO_USERS]
    for user in users:
        for track in tracks:
            score = 5 + (track.position * 7 + TASTE[user.username]) % 6
            _rate(user, "song", track.song_id, score)
        if user.username in REVIEWS:
            _rate(user, "album", albums[0].id, 9, REVIEWS[user.username])
    _demo_playlist(users[0], albums)
    db.session.commit()
    return {"artists": len(catalog), "albums": len(albums), "users": len(users)}


def _demo_user(username: str) -> User:
    db.session.execute(
        insert(User)
        .values(
            email=f"{username}@example.com",
            username=username,
            password_hash=generate_password_hash(DEMO_PASSWORD),
        )
        .on_conflict_do_nothing()
    )
    return db.session.scalar(select(User).filter_by(username=username))


def _rate(user: User, kind: str, target_id: int, score: int, review: str | None = None) -> None:
    db.session.execute(
        insert(Rating)
        .values(user_id=user.id, score=score, review=review, **{f"{kind}_id": target_id})
        .on_conflict_do_nothing()
    )


def _demo_playlist(owner: User, albums: list[Album]) -> None:
    name = "Late night listening"
    if db.session.scalar(select(Playlist).filter_by(owner=owner, name=name)):
        return
    openers = [track.song for album in albums for track in album.tracks[:2]]
    db.session.add(
        Playlist(
            owner=owner,
            name=name,
            description="Two openers from every record in the demo catalog.",
            entries=[PlaylistSong(song=song, position=i) for i, song in enumerate(openers, 1)],
        )
    )


@click.command("seed")
def seed_command() -> None:
    """Cache the demo catalog and create demo users"""
    result = seed(CATALOG)
    click.echo(f"Seeded {result['artists']} artists, {result['albums']} albums, demo users:")
    for username in DEMO_USERS:
        click.echo(f"  {username}@example.com / {DEMO_PASSWORD}")
```

Register the command in `api/app/__init__.py`. Import `from app.seed import seed_command`, then add this line after the blueprint loop:

```python
    app.cli.add_command(seed_command)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_seed.py -v`
Expected: 4 passed. Alex and Sam rate the first album an explicit 4.5 while Jordan's rating is derived from shifted song scores, so the community average lands below Alex's.

- [ ] **Step 5: Seed the real database**

```bash
flask seed
```

Expected: about 20 seconds of MusicBrainz requests at one per second, then the three demo logins printed.

- [ ] **Step 6: Lint, format, and commit**

```bash
ruff format . && ruff check .
git add api/
git commit -m "feat(api): add flask seed command with demo catalog and users"
```

### Task 2: Full suite on the merged main

**Files:**
- None, verification only

**Interfaces:**
- Consumes: all slices merged
- Produces: a green baseline the walkthrough starts from

- [ ] **Step 1: Run every automated check from a clean database**

```bash
git checkout main && git pull
docker compose down -v && docker compose up -d --wait
cd api && pip install -r requirements-dev.txt && flask db upgrade && flask db check && ruff check . && pytest
cd ../web && npm ci && npm run lint && npm test && npm run build
```

Expected: `No new upgrade operations detected.`, zero ruff findings, every pytest and vitest test passing, and a successful build. Fix any failure in a small PR before moving on, and note the cause in the PR description.

### Task 3: Walkthrough of every spec goal

**Files:**
- None, verification only

**Interfaces:**
- Consumes: the seeded app
- Produces: a confirmed demo path, or GitHub issues labeled `bug` for each failure

Run `flask seed`, start both servers, and use a normal browser window as Alex and a private window for a new user.

- [ ] **Step 1: Register and log in**

In the private window, open `/register`, sign up as `taylor`, and confirm the header shows History, Playlists, and taylor. Log out, log back in, and confirm you land where you were.
Expected: no flash of logged-out UI on reload, and a bad password shows "Email or password is incorrect".

- [ ] **Step 2: Search all three kinds**

Search `radiohead` under Artists, `ok computer` under Albums, and `karma police` under Songs. Then search `AC/DC`.
Expected: skeletons while loading, then results. Live recordings show their disambiguation. `AC/DC` returns results, not an error. Back and forward restore each search.

- [ ] **Step 3: Artist top five**

Open Radiohead.
Expected: five popular songs in rank order, each with a compact rating control, plus a list of studio albums. The second visit loads instantly.

- [ ] **Step 4: Rate songs and watch the album average**

As taylor, open OK Computer and rate three tracks 3.5, 4, and 3.5.
Expected: the album shows "3.7, average of your 3 song ratings", and the community line includes taylor.

- [ ] **Step 5: Override and clear**

Rate the album itself 4.5, then press Clear.
Expected: 4.5 shows as your own rating, and Clear returns to 3.7 derived. Do the same on Radiohead's artist page.

- [ ] **Step 6: Reviews**

Write a review on OK Computer, paste 2,100 characters, then save a shorter one. As Alex, open the same album.
Expected: the counter stops at 2000, and the saved review appears in Alex's view of the reviews list with taylor's name and date. A review of only spaces never appears.

- [ ] **Step 7: Playlists**

As taylor, add three songs to a new playlist from a search result, an album tracklist, and the top five. Reorder them, remove one, then make the playlist private. As Alex, open its URL.
Expected: duplicates show "Already added", the order persists after reload, and Alex gets the not found state for the private playlist, never its contents.

- [ ] **Step 8: History**

Open taylor's history and filter by Songs, Albums, and Artists.
Expected: only explicit ratings appear, newest first. Albums rated only through their songs do not appear.

- [ ] **Step 9: Record results**

File a GitHub issue labeled `bug` for every mismatch, with the step number, what happened, and a screenshot. Fix each in its own small PR against `main`.

### Task 4: Polish audit

**Files:**
- Modify: whichever files the audit flags

**Interfaces:**
- Consumes: the walkthrough build
- Produces: a UI that meets CLAUDE.md's shipping checklist

- [ ] **Step 1: Check each item and fix failures**

| Check | Pass criteria |
|---|---|
| Responsive | Every page at 375px wide has no horizontal scroll, the header wraps cleanly, and tap targets are at least 40px tall |
| Loading | Every query shows a skeleton and every mutation button shows its spinner. Nothing pops in without a placeholder |
| Empty and error states | Search before typing, search with no results, an album with no reviews, an empty history, and an empty playlist each show a Notice. Stopping Flask mid-session shows "Could not reach the server" with Try again |
| Keyboard | Tab reaches every control in order, stars respond to arrow keys, the playlist menu closes on Escape and returns focus, and focus rings are always visible |
| Titles | Every route sets a tab title ending in "| TrackmyTracks" |
| Consistency | Search the CSS for raw colors, raw pixel spacing, or any radius other than `var(--radius)` and `var(--radius-full)`, then replace them with tokens |
| Copy | No placeholder text, no "Lorem", and no exclamation marks in UI copy |
| Console | No errors or React warnings in the browser console across the walkthrough |

The consistency search:

```bash
cd web && grep -rnE "#[0-9a-fA-F]{3,6}\b|[0-9]+px|border-radius: [0-9]" src --include=*.css | grep -v tokens.css
```

Expected: no output apart from the `2px` focus outline and spinner border widths.

- [ ] **Step 2: Commit each fix with what it addressed**

```bash
git commit -m "fix(web): <what the audit found>"
```

### Task 5: Demo readiness

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1 to 4
- Produces: a tagged prototype anyone can run

- [ ] **Step 1: Add the demo section to `README.md`**

Insert before the Earlier prototype section:

````markdown
### Demo data

From the activated API terminal in `api/`, run `flask seed`. It caches four albums from MusicBrainz and creates three accounts, `alex`, `sam`, and `jordan`, all `@example.com` with password `listen-demo`. Safe to run more than once.
````

- [ ] **Step 2: Commit, open the pull request, and tag after merge**

```bash
git add README.md
git commit -m "docs: document demo seed data"
git push -u origin slice/10-integration
gh pr create --fill --base main
```

After the pull request merges:

```bash
git checkout main && git pull
git tag -a v0.1.0 -m "Local prototype"
git push origin v0.1.0
```
