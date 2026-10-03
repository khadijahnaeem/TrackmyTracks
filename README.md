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

Paste the printed value into `SECRET_KEY` in `.env`, then start Postgres. Run this again each day before working.

```bash
docker compose up -d --wait
```

Postgres 16 listens on `localhost:5433` with a `trackmytracks` database for development and `trackmytracks_test` for tests. To wipe both and start fresh:

```bash
docker compose down -v
docker compose up -d --wait
```

### Earlier prototype

`frontend/` holds the first React prototype and needs Node 22 or newer. From `frontend/`, run `npm install` once, then `npm run dev`.

## Workflow

Plans live in `docs/superpowers/plans/`. Each slice is a branch named `slice/NN-name` and one pull request into `main`, which needs one approving review and a green CI run.
