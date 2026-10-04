# 001 Local Prototype Design

TrackmyTracks is a Letterboxd-style app for music. Users rate and review songs, albums, and artists, build playlists, and browse other users' reviews. This spec covers the first milestone: a full-featured prototype that runs locally, built by a team of four in one week. Deployment is out of scope and gets its own spec.

## Goals

The prototype is done when a teammate can clone the repo, run three commands, and then:

1. Register and log in
2. Search songs, albums, and artists
3. Open an artist and see their top 5 popular songs
4. Rate songs in half stars and see the album and artist averages update
5. Override an album or artist rating, then clear the override
6. Write a review and read other users' reviews
7. Create a playlist, add songs, and reorder them
8. View their history of rated songs, albums, and artists

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Repo layout | Monorepo, `api/` and `web/` | One PR per full-stack feature |
| Backend | Flask app factory, one Blueprint per feature, SQLAlchemy 2.0, Flask-Migrate | Feature folders keep four people out of each other's files, migrations keep databases in sync |
| Frontend | Vite, React, TypeScript, React Router, TanStack Query | Fast dev server, typed API calls, built-in loading and error state |
| Local env | Postgres 16 in Docker, Flask and Vite run natively | Same database everywhere, fast reloads and native debugging |
| Music data | MusicBrainz live API, entities cached in Postgres on first touch | Small local database, current data, no mirror to maintain |
| Popular hits | ListenBrainz top recordings for artist, first 5 | MusicBrainz has no popularity data, ListenBrainz uses the same IDs |
| Auth | Email and password, Flask session in an httpOnly cookie | Simplest secure option, Vite proxy makes it same-origin |
| Rating input | Half stars, 0.5 to 5, stored as integer 1 to 10 | Letterboxd feel, no float storage |
| Averages | Decimal stars to one place, like 3.7 | Shows meaningful differences between albums |
| Reviews | Part of the rating row, max 2,000 characters | One table drives history and review feeds |

## Architecture

```
TrackmyTracks/
  docker-compose.yml          postgres:16, named volume, host port 5433
  .env.example                DATABASE_URL, TEST_DATABASE_URL, SECRET_KEY, MB_USER_AGENT, FLASK_RUN_PORT
  api/
    app/__init__.py           create_app(), registers blueprints, error handlers, client, seed command
    app/extensions.py         db, migrate, constraint naming convention
    app/errors.py             ApiError and JSON error handlers
    app/http.py               request parsing and pagination helpers
    app/models.py             all SQLAlchemy models
    app/kinds.py              song, album, artist and their models
    app/views.py              effective rating views as read only tables
    app/musicbrainz.py        MusicBrainz and ListenBrainz client
    app/seed.py               flask seed demo data
    app/auth/                 routes, session helpers, serializers
    app/catalog/              routes, service with get_or_cache_*, serializers
    app/ratings/              routes, service, rating summary queries
    app/history/              routes
    app/playlists/            routes, service
    migrations/
    tests/                    pytest, fixtures/ holds recorded MB JSON, fakes.py
  web/
    src/api/                  fetch wrapper, response types, query client
    src/ui/                   design tokens, Button, Card, TextField, TextArea, Stars, Skeleton, Pagination
    src/features/auth/
    src/features/catalog/
    src/features/ratings/     RatingControl, ReviewList, ReviewComposer
    src/features/history/
    src/features/playlists/
```

### Running locally

```
docker compose up -d --wait
cd api && flask db upgrade && flask run      # :5001
cd web && npm run dev                        # :5173, proxies /api to 127.0.0.1:5001
```

The browser only talks to `:5173`, so session cookies work without CORS setup. Postgres uses host port 5433 so it never clashes with a local install, and Flask uses 5001 because macOS reserves 5000 for AirPlay.

### MusicBrainz client

`app/musicbrainz.py` is the only module that calls external services.

- Sends the `User-Agent` MusicBrainz requires, read from `MB_USER_AGENT`
- Holds a process-wide lock that spaces MusicBrainz requests at least 1 second apart
- Uses a 5 second request timeout. A failure raises `CatalogUnavailable`, which the API returns as a 502
- A 400 or 404 raises `NotFound`. Any other failure, including a 503 rate limit, raises `CatalogUnavailable`
- Search text is Lucene escaped so input like `AC/DC` is literal
- When an album is cached, its tracklist comes from the earliest official release in the release group
- An artist's discography lists studio albums only, those without secondary types like Live
- Top songs come from ListenBrainz, an artist with no listening data has none
- Songs and albums store only their first credited artist
- Every cached row is written with `INSERT ... ON CONFLICT` on its MBID, so concurrent first visits never collide

## Data model

```
users            id, email UNIQUE, username UNIQUE, password_hash, created_at
artists          id, mbid UNIQUE, name, fetched_at NULL
albums           id, mbid UNIQUE (release group), title, artist_id FK, release_year NULL, fetched_at NULL
songs            id, mbid UNIQUE (recording), title, disambiguation NULL, length_ms NULL, artist_id FK
album_songs      album_id FK, song_id FK, position
                 PK(album_id, song_id)
artist_top_songs artist_id FK, rank, song_id FK
                 PK(artist_id, rank)

ratings          id, user_id FK ON DELETE CASCADE,
                 song_id FK NULL, album_id FK NULL, artist_id FK NULL,
                 score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
                 review VARCHAR(2000) NULL CHECK (review <> ''),
                 created_at, updated_at
                 CHECK (num_nonnulls(song_id, album_id, artist_id) = 1)
                 UNIQUE (user_id, song_id), (user_id, album_id), (user_id, artist_id)

playlists        id, user_id FK ON DELETE CASCADE,
                 name VARCHAR(100) NOT NULL CHECK (name <> ''),
                 description VARCHAR(500) NULL CHECK (description <> ''),
                 is_public BOOLEAN NOT NULL DEFAULT true,
                 created_at, updated_at

playlist_songs   playlist_id FK ON DELETE CASCADE, song_id FK, position INTEGER NOT NULL, added_at
                 PK(playlist_id, song_id)
                 UNIQUE(playlist_id, position) DEFERRABLE INITIALLY DEFERRED
```

`fetched_at` marks a fully cached row. An artist is fully cached once its discography and top songs are stored, and an album once its tracklist is stored. Rows created along the way, like the artist of a rated song, stay NULL until their own page is opened. The rating unique constraints need no partial index because Postgres treats NULLs as distinct.

Validation rules enforced in the API as well as the database:

- Username is 3 to 30 characters of lowercase letters, digits, and underscores
- Password is at least 8 characters, hashed with werkzeug's default scrypt
- Review and description are trimmed, an empty result is stored as NULL
- A playlist holds at most 500 songs

### Effective ratings

All stars shown in the UI come from three views with the same columns, `(user_id, target_id, stars, is_derived, song_count)`. Nothing derived is stored, so nothing can go stale. `song_effective_ratings` maps each song rating to `score / 2.0`, which lets one query serve every kind.

`album_effective_ratings`

- If the user has an explicit album rating, `stars = score / 2.0` and `is_derived = false`. This is the override
- Otherwise `stars = ROUND(AVG(song score) / 2.0, 1)` across the user's ratings of songs in `album_songs` for that album, `is_derived = true`
- No row exists when the user has neither

`artist_effective_ratings` follows the same rules, averaging the user's song ratings where `songs.artist_id` matches.

Community averages:

- `ROUND(AVG(stars), 1)` across the effective view for every kind, so personal and community numbers use the same rule

Example: a user rates three songs on an album 3.5, 4, and 3.5 stars (7, 8, 7). The album shows **3.7, avg of 3 songs**. Rating the album 4.5 shows **4.5** as an override. Clearing it returns to 3.7.

History lists explicit ratings only. An album with only a derived rating appears on its album page, not in history.

## API

All routes live under `/api` and return JSON. Catalog URLs use the MusicBrainz ID so search results link straight to detail pages.

### Auth

```
POST /auth/register     {email, username, password}     logs in on success
POST /auth/login        {email, password}
POST /auth/logout
GET  /auth/me           {user} with null when logged out
```

Session cookie is httpOnly with `SameSite=Lax`. Every write route requires login.

### Catalog

```
GET /search?type=song|album|artist&q=&page=    live MusicBrainz, 25 per page, nothing cached
GET /artists/<mbid>     artist, top 5 hits, albums, your effective rating, community average
GET /albums/<mbid>      album, tracklist with your song ratings, your effective rating, community average
GET /songs/<mbid>       song, your rating, community average
```

A detail request for an uncached entity fetches it from MusicBrainz, writes the artist, album, and songs in one transaction, then answers from Postgres. The service exposes `get_or_cache_artist`, `get_or_cache_album`, and `get_or_cache_song`, and other features call these rather than the client.

### Ratings and reviews

```
PUT    /ratings                         {kind, mbid, stars, review?}    upsert, caches the target
DELETE /ratings/<kind>/<mbid>           removes your rating, an override falls back to the average
GET    /<kind>s/<mbid>/reviews?page=    ratings with review text, newest first, 20 per page
GET    /users/<username>/history?kind=&page=    explicit ratings, newest first, 20 per page
```

`stars` is half stars from 0.5 to 5 on the wire and `score` 1 to 10 in the database. PUT and DELETE both answer with the target's fresh rating summary, so the UI shows a derived average the moment an override is cleared.

### Playlists

```
GET    /users/<username>/playlists      public ones, plus private when viewing your own
POST   /playlists                       {name, description?, is_public?}
GET    /playlists/<id>                  playlist with ordered songs
PATCH  /playlists/<id>                  {name?, description?, is_public?}
DELETE /playlists/<id>
POST   /playlists/<id>/songs            {mbid}    appends, caches the song
DELETE /playlists/<id>/songs/<mbid>
PUT    /playlists/<id>/songs            {mbids: [...]}    full reorder in one transaction
```

Songs can be added from the song page, album tracklist, search results, and top hits. Every playlist route loads through one `owned_playlist_or_404` helper for writes and a visibility check for reads. Another user's private playlist returns 404 so its existence is not revealed.

## Error handling

Every error uses one shape, produced by the handlers in `app/errors.py`:

```json
{"error": {"code": "validation_error", "message": "Review must be 2000 characters or fewer"}}
```

| Case | Status | Code |
|---|---|---|
| Invalid input, limits exceeded | 422 | `validation_error` |
| Not logged in | 401 | `unauthorized` |
| Missing, or another user's private playlist | 404 | `not_found` |
| Duplicate email or username, duplicate playlist song | 409 | `conflict` |
| MusicBrainz or ListenBrainz unavailable | 502 | `catalog_unavailable` |

Frontend handling goes through TanStack Query:

- Data pages show skeletons while loading
- Buttons show a spinner while their request runs
- A 502 shows an inline message with a retry button
- Rating saves are optimistic and roll back on failure
- A 401 sends the user to the login page and returns them afterwards

## Testing

- pytest runs against `trackmytracks_test` in the same Docker Postgres. The schema is rebuilt from migrations once per run and every table is truncated after each test
- The MusicBrainz client is replaced by a fake that runs the real parsing over recorded JSON fixtures, so tests never call the network
- Required coverage: effective-rating views (derived average, override, clearing, rounding to one decimal), validation limits, playlist ownership and visibility, auth flow
- Other routes get one happy-path test each
- Vitest and Testing Library cover the `ui/` components, the API client, and each feature's components and pages against a stubbed `fetch`
- GitHub Actions runs ruff, a migration drift check, pytest, oxlint, vitest, and the production build on every pull request. `main` is protected and needs one approving review

## Work breakdown

The implementation plan splits the week into ten slices, each one branch and one pull request. The plan index at `docs/superpowers/plans/001-local-prototype.md` pins the shared contracts so slices can run in parallel.

| Day | Dev 1 | Dev 2 | Dev 3 | Dev 4 |
|---|---|---|---|---|
| 1 | 02 API foundation | 03 Web foundation | 04 Music catalog service | 01 Dev environment, then help on 04 |
| 2 to 4 | 05 Auth, then 09 History | 06 Catalog pages | 07 Ratings and reviews | 08 Playlists |
| 6 and 7 | 10 Integration | 10 Integration | 10 Integration | 10 Integration |

The full schema and all three views ship in one initial migration so no conflicting migrations appear during the week. Slice 07's rating components and slice 08's add to playlist button merge before slice 06's pages, which mount them, so no two people edit the same page files.

## Out of scope

Each of these gets its own spec after the prototype:

- Deployment
- User profiles, following, activity feed
- Album art from the Cover Art Archive
- Multi-artist credits
- Caching search results
