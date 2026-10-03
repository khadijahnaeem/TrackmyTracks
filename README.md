# TrackmyTracks
A social music discovery and review web app where users can rate songs, write reviews, keep track of what they’ve listened to, create lists, and discover new music through other users—similar to Letterboxd, but designed for songs.

## Created By
- Khadijah Naeem
- Eyan Ghirbn
- Samuel Newville
- Saer Axmed

## Running locally

Requires Docker Desktop, Python 3.12, and Node 22 or newer.

### First time

```bash
cp .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
```

Paste the printed value into `SECRET_KEY` in `.env`.

```bash
docker compose up -d --wait

cd api
py -3.12 -m venv .venv              # macOS and Linux: python3.12 -m venv .venv
.venv\Scripts\activate              # macOS and Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
flask db upgrade

cd ../web
npm install
```

### Every day

```bash
docker compose up -d --wait
cd api && flask run          # http://localhost:5001
cd web && npm run dev        # http://localhost:5173, open this one
```

Vite proxies `/api` to Flask, so the browser only ever talks to port 5173.

### Tests

```bash
cd api && pytest
cd web && npm test
```

### Resetting the database

```bash
docker compose down -v
docker compose up -d --wait
cd api && flask db upgrade
```

## Workflow

Plans live in `docs/superpowers/plans/`. Each slice is a branch named `slice/NN-name` and one pull request into `main`, which needs one approving review and a green CI run.
