# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TrackmyTracks is a Letterboxd-style app for music. Users rate and review songs, albums, and artists in half stars, build playlists, and browse other users' reviews. The current milestone is a prototype that runs locally, built by a team of four.

The design and the work breakdown are already written. Read them before changing anything:

- `docs/superpowers/specs/001-local-prototype-design.md` is the spec
- `docs/superpowers/plans/001-local-prototype.md` is the plan index. Its Global Constraints and Contracts bind every slice, and changing a contract means updating the index in the same pull request
- `docs/superpowers/plans/001-local-prototype/NN-*.md` are the ten slice plans

## Current state

The repo is built slice by slice, and the architecture below is in place.

- Slice 01 provides `docker-compose.yml`, `docker/initdb/`, `.env.example`, and the README setup guide
- Slices 01 to 09 are merged, and slice 10 integrates them into a demoable prototype
- `api/` arrives with slice 02 and `web/` with slice 03
- `frontend/` and `css/` hold the team's earlier homepage prototype. They predate the plan and are not part of it

## Commands

Postgres, from the repository root:

```bash
docker compose up -d --wait      # start, port 5433, dev and test databases
docker compose down -v           # wipe both databases
```

API, from `api/` with `.venv` activated (slice 02 onward):

```bash
flask run                                   # http://localhost:5001
flask db upgrade                            # after every database reset
flask db migrate -m "<what changed>"        # then review the generated file
flask db check                              # fails when models and migrations drift
pytest                                      # all tests
pytest tests/test_session.py -k deleted     # one test
ruff format . && ruff check .               # before every commit
```

Web, from `web/` (slice 03 onward):

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
- Flask uses an app factory with one Blueprint per feature (`auth`, `catalog`, `ratings`, `playlists`, `history`). Feature slices only add routes to their own `routes.py`, which keeps four people out of each other's files
- `app/musicbrainz.py` is the only module that touches the network. It rate limits MusicBrainz to one request per second and maps failures to `CatalogUnavailable` (502)
- Catalog entities are cached into Postgres on first visit through `get_or_cache_*` in `app/catalog/service.py`, using `INSERT ... ON CONFLICT` on the MBID. Other features call the service, never the client
- Album and artist ratings are never stored. Three SQL views compute effective ratings, an explicit rating overrides the average of the user's song ratings, and `app/ratings/queries.py` is the single read path for every page
- The full schema and all views ship in one initial migration so parallel slices never produce conflicting migrations
- pytest runs against `trackmytracks_test`, rebuilt from migrations once per run and truncated after each test. A `FakeMusicBrainz` over recorded JSON fixtures replaces the client, so tests never hit the network
- The web app keeps server state in TanStack Query with fixed query keys listed in the plan index. Pages use only `src/ui/` components and tokens from `src/ui/tokens.css`

## Workflow

- Each slice is a branch named `slice/NN-name` and one pull request into `main`, which needs one approving review and green CI
- Each slice adds its own README section when it lands, so the README only describes folders that exist. README commands must work when pasted into a fresh terminal
- Specs go in `docs/superpowers/specs/NNN-<topic>-design.md` and plans in `docs/superpowers/plans/NNN-<topic>.md`. A spec and its plan share a 3 digit ID, and IDs are never reused
- Files use LF line endings, enforced by `.gitattributes` and `.editorconfig`

## Code comments

Comments are brief, informal, and useful. ASCII only, no divider lines, no semicolons or dashes as punctuation, no first person, and one liners never end in a period. Use "like" or "such as" instead of "e.g.". Longer explanations belong in the spec, not the code.

## Claude file log

`claude-files.txt` lists every file Claude Code has created or modified, one repo-relative path per line, sorted. When Claude creates or edits a file, add its path in the same commit if it is not already listed. Remove a path only when the file is deleted.
