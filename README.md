# TrackmyTracks
A social music discovery and review web app where users can rate songs, write reviews, keep track of what they’ve listened to, create lists, and discover new music through other users—similar to Letterboxd, but designed for songs.

## Created By
- Khadijah Naeem
- Eyan Ghirbn
- Samuel Newville
- Saer Axmed

## Running locally

Requires Docker Desktop and Python 3.

### Database

First time, from the repository root:

```bash
cp .env.example .env
py -c "import secrets; print(secrets.token_hex(32))"    # python3 on macOS and Linux
```

Paste the printed value into `SECRET_KEY` in `.env`. Copy your user token from https://listenbrainz.org/settings/ into `LISTENBRAINZ_TOKEN`, then start Postgres. Run this again each day before working.

```bash
docker compose up -d --wait
```

Postgres 16 listens on `localhost:5433` with a `trackmytracks` database for development and `trackmytracks_test` for tests. To wipe both and start fresh:

```bash
docker compose down -v
docker compose up -d --wait
```

### API

Requires Python 3.12. The API runs in its own terminal from `api/`, with the virtual environment active.

```bash
cd api
py -3.12 -m venv .venv                 # first time only, python3.12 on macOS and Linux
.venv\Scripts\activate                 # every new terminal, source .venv/bin/activate on macOS and Linux
pip install -r requirements-dev.txt    # first time only
flask db upgrade                       # first time and after every database reset
flask run                              # http://localhost:5001
```

Run the API tests with `pytest` from the same activated terminal.

### Web

Requires Node 22 or newer. The web app runs in its own terminal from `web/`, next to the API terminal.

```bash
cd web
npm install      # first time only
npm run dev      # http://localhost:5173, open this one
```

Vite proxies `/api` to Flask, so the browser only ever talks to port 5173. Run the web tests with `npm test` from `web/`.

### Demo data

From the activated API terminal in `api/`, run `flask seed`. It caches four albums from MusicBrainz, about half a minute on the first run, and creates three accounts, `alex`, `sam`, and `jordan`, all `@example.com` with password `listen-demo`. Safe to run more than once.

### Earlier prototype

`frontend/` holds the first React prototype and needs Node 22 or newer. From `frontend/`, run `npm install` once, then `npm run dev`.

## Workflow

Plans live in `docs/superpowers/plans/`. Each slice is a branch named `slice/NN-name` and one pull request into `main`, which needs one approving review and a green CI run.
