# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TrackmyTracks is a Letterboxd-style app for music. Users rate and review songs, albums, and artists in half stars, build playlists, and browse other users' reviews. The current milestone is a prototype that runs locally, built by a team of four.

Read the design before changing anything:

- `docs/superpowers/specs/001-local-prototype-design.md` is the spec
- `docs/superpowers/plans/001-local-prototype.md` is the plan index. Its Global Constraints and Contracts, including the JSON shapes and API routes, bind all work, and changing a contract means updating the index in the same pull request
- `docs/superpowers/plans/001-local-prototype/NN-*.md` are the ten slice plans, now history
- Specs and plans 002 (home page) and 003 (UI first build order) cover later work

## Current state

- Every slice is merged, including slice 10 integration, so the prototype runs end to end against Flask and Postgres. The browser mock API from 003 has been removed
- Work now lands as small feature pull requests on top of the prototype, like the search ranking and listen count changes
- `docker-compose.yml`, `docker/initdb/`, and `.env.example` set up Postgres, `api/` is the Flask API, and `web/` is the React app
- The home page Trending and Fresh reviews sections still show static sample data from `web/src/features/home/sampleData.ts`, since the API has no trending or recent reviews routes yet
- `frontend/` and `css/` hold the team's earlier homepage prototype. They predate the plan and are not part of it

## Commands

Postgres, from the repository root:

```bash
docker compose up -d --wait      # start, port 5433, dev and test databases
docker compose down -v           # wipe both databases
```

API, from `api/` with `.venv` activated:

```bash
flask run                                   # http://localhost:5001
flask db upgrade                            # after every database reset
flask seed                                  # demo catalog plus alex, sam, jordan at example.com, password listen-demo
flask db migrate -m "<what changed>"        # then review the generated file
flask db check                              # fails when models and migrations drift
pytest                                      # all tests
pytest tests/test_session.py -k deleted     # one test
ruff format . && ruff check .               # before every commit
```

Web, from `web/`:

```bash
npm run dev                                 # http://localhost:5173, proxies /api to Flask
npm test                                    # vitest run
npx vitest run src/ui/Stars.test.tsx        # one file
npm run lint                                # before every commit
npm run build
```

The legacy `frontend/` app runs with `npm run dev` from its own folder.

## Architecture

- The browser only talks to Vite on 5173, which proxies `/api` to Flask on 5001, so the session cookie is same-origin with no CORS setup
- Flask uses an app factory with one Blueprint per feature (`auth`, `catalog`, `ratings`, `playlists`, `history`). Each feature keeps its routes in its own `routes.py`, which keeps four people out of each other's files
- `app/musicbrainz.py` is the only module that touches the network. It talks to MusicBrainz for catalog data, rate limited to one request per second, and to ListenBrainz with `LISTENBRAINZ_TOKEN` for listen counts. Failures map to `CatalogUnavailable` (502)
- Song and artist search take the top 100 MusicBrainz matches and page them on the server. Songs are reranked by how many query words they match, then by ListenBrainz listens. Artists with no listens and no credited recording are dropped. Song and artist rows carry `listens`. Each query's ranked window is cached in memory for 10 minutes, so pages stay consistent and only the first page calls out, and a ListenBrainz failure falls back to MusicBrainz order without caching. Album search pages through MusicBrainz directly
- Artist pages take their top five songs from ListenBrainz popularity
- `flask seed` in `app/seed.py` caches four albums and creates three demo users with ratings, reviews, and a playlist. Running it again changes nothing
- Catalog entities are cached into Postgres on first visit through `get_or_cache_*` in `app/catalog/service.py`, using `INSERT ... ON CONFLICT` on the MBID. Other features call the service, never the client
- Album and artist ratings are never stored. Three SQL views compute effective ratings, an explicit rating overrides the average of the user's song ratings, and `app/ratings/queries.py` is the single read path for every page
- The schema and all views ship in one initial migration, `0001_initial_schema.py`. Schema changes now add a new migration with `flask db migrate`
- pytest runs against `trackmytracks_test`, rebuilt from migrations once per run and truncated after each test. A `FakeMusicBrainz` over recorded JSON fixtures replaces the client, so tests never hit the network
- The web app keeps server state in TanStack Query with fixed query keys listed in the plan index. Pages use only `src/ui/` components and tokens from `src/ui/tokens.css`

## Workflow

- Each change is a branch named `<type>/<topic>` and one pull request into `main`, which needs one approving review and green CI. The type matches the commit prefix (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`) and the topic is a few kebab case words, like `feat/search-listen-counts`. The original slices used `slice/NN-name`
- A change that adds a command, setting, or setup step updates the README in the same pull request. README commands must work when pasted into a fresh terminal
- Specs go in `docs/superpowers/specs/NNN-<topic>-design.md` and plans in `docs/superpowers/plans/NNN-<topic>.md`. A spec and its plan share a 3 digit ID, and IDs are never reused
- Files use LF line endings, enforced by `.gitattributes` and `.editorconfig`

## Code comments

Comments are brief, informal, and useful. ASCII only, no divider lines, no semicolons or dashes as punctuation, no first person, and one liners never end in a period. Use "like" or "such as" instead of "e.g.". Longer explanations belong in the spec, not the code.

## Claude file log

`claude-files.txt` lists every file Claude Code has created or modified, one repo-relative path per line, sorted. When Claude creates or edits a file, add its path in the same commit if it is not already listed. Remove a path only when the file is deleted.
