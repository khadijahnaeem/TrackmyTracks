# Slice 01 Dev Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every teammate the same Postgres, the same env vars, and the same line endings with one `docker compose up -d`.

**Architecture:** Postgres 16 runs in Docker with a named volume. An init script creates a second database for tests. Flask and Vite run natively and read a root `.env`.

**Tech Stack:** Docker Compose, Postgres 16, git attributes

**Spec:** `docs/superpowers/specs/001-local-prototype-design.md`

**Index:** `docs/superpowers/plans/001-local-prototype.md`. Its Global Constraints and Contracts apply to every task here.

**Branch:** `slice/01-dev-environment`

---

### Task 0: Prerequisites

Every teammate does this once on their own machine. Nothing is committed.

- [ ] **Step 1: Install tools**

| Tool | Version | Check |
|---|---|---|
| Docker Desktop | current | `docker --version` and `docker compose version` |
| Python | 3.12 | `py -3.12 --version` on Windows, `python3.12 --version` elsewhere |
| Node | 22 or newer | `node --version` |

On Windows, enable the WSL 2 backend when Docker Desktop asks, then start Docker Desktop before running any `docker` command.

- [ ] **Step 2: Branch**

```bash
git checkout main && git pull
git checkout -b slice/01-dev-environment
```

### Task 1: Postgres, env, and repo hygiene

**Files:**
- Create: `docker-compose.yml`
- Create: `docker/initdb/01-create-test-db.sql`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `.gitattributes`
- Create: `.editorconfig`

**Interfaces:**
- Consumes: nothing
- Produces: Postgres on `localhost:5433` with databases `trackmytracks` and `trackmytracks_test`, user and password `trackmytracks`. Env vars `DATABASE_URL`, `TEST_DATABASE_URL`, `SECRET_KEY`, `MB_USER_AGENT` read by slice 02, and `FLASK_RUN_PORT=5001` read by `flask run`.

Host port 5433 avoids clashing with a Postgres that a teammate may already have installed on 5432.

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: trackmytracks
      POSTGRES_PASSWORD: trackmytracks
      POSTGRES_DB: trackmytracks
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/initdb:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U trackmytracks"]
      interval: 2s
      timeout: 5s
      retries: 15

volumes:
  pgdata:
```

- [ ] **Step 2: Write `docker/initdb/01-create-test-db.sql`**

Postgres runs this only when the volume is first created.

```sql
CREATE DATABASE trackmytracks_test;
```

- [ ] **Step 3: Write `.env.example`**

```dotenv
DATABASE_URL=postgresql+psycopg://trackmytracks:trackmytracks@localhost:5433/trackmytracks
TEST_DATABASE_URL=postgresql+psycopg://trackmytracks:trackmytracks@localhost:5433/trackmytracks_test
SECRET_KEY=replace-with-output-of-python-secrets-token-hex
MB_USER_AGENT=TrackmyTracks/0.1 ( https://github.com/khadijahnaeem/TrackmyTracks )
FLASK_RUN_PORT=5001
```

Flask uses 5001 because macOS reserves 5000 for AirPlay Receiver.

- [ ] **Step 4: Write `.gitignore`**

```gitignore
.env
.venv/
__pycache__/
*.pyc
.pytest_cache/
.ruff_cache/
node_modules/
dist/
coverage/
*.log
.DS_Store
```

- [ ] **Step 5: Write `.gitattributes` and `.editorconfig`**

Mixed Windows and macOS machines otherwise produce whole-file CRLF diffs.

`.gitattributes`:

```gitattributes
* text=auto eol=lf
```

`.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2

[*.py]
indent_size = 4
```

- [ ] **Step 6: Verify the databases exist**

```bash
cp .env.example .env
docker compose up -d --wait
docker compose exec db psql -U trackmytracks -lqt
```

Expected: `docker compose up` reports `db` as Healthy, and the `psql` listing includes both `trackmytracks` and `trackmytracks_test`.

If `trackmytracks_test` is missing, the volume existed before the init script was added. Recreate it with `docker compose down -v && docker compose up -d --wait`.

- [ ] **Step 7: Commit**

```bash
git add --renormalize .
git add docker-compose.yml docker/ .env.example .gitignore .gitattributes .editorconfig
git commit -m "chore: add local postgres, env template, and repo hygiene"
```

### Task 2: README setup guide

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1
- Produces: the setup steps every slice's verification relies on

- [ ] **Step 1: Append the setup section to `README.md`**

Keep the existing intro and team list, then append:

````markdown
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
````

- [ ] **Step 2: Verify the steps read correctly**

Run: `git diff README.md`
Expected: the intro and team list are unchanged and the new sections follow them.

- [ ] **Step 3: Commit and open the pull request**

```bash
git add README.md
git commit -m "docs: add local setup guide"
git push -u origin slice/01-dev-environment
gh pr create --fill --base main
```
