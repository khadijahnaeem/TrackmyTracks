# Slice 05 Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** People can register, log in, and log out, the header shows who is logged in, and any write that comes back 401 sends them to log in and back.

**Architecture:** Four routes on the existing `auth` Blueprint use the slice 02 session helpers. Duplicate emails and usernames are caught from the unique constraints, never pre-checked. On the web, three mutations own the `["me"]` cache, and one hook in `AppShell` watches the mutation cache for 401s.

**Tech Stack:** Flask, werkzeug password hashing, psycopg error diagnostics, React Router 7, TanStack Query 5, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/001-local-prototype-design.md`

**Index:** `docs/superpowers/plans/001-local-prototype.md`. Its Global Constraints and Contracts apply to every task here.

**Branch:** `slice/05-auth`. Requires slices 02 and 03 merged.

**Merge early:** push Task 1 as its own pull request as soon as it passes, slices 07 and 08 need `public_user` and working login.

---

## File map

```
api/
  app/auth/serializers.py       user_payload, public_user
  app/auth/routes.py            register, login, logout, me
  tests/test_auth.py
web/src/
  features/auth/redirects.ts    safeNext, authHref, loginHref
  features/auth/api.ts          useLogin, useRegister, useLogout
  features/auth/useUnauthorizedRedirect.ts
  features/auth/AuthLayout.tsx, auth.module.css
  features/auth/LoginPage.tsx, RegisterPage.tsx
  features/auth/AccountNav.tsx, AccountNav.module.css
  features/auth/routes.ts       filled in
  app/AppShell.tsx, AppShell.module.css   mount AccountNav and the 401 hook
  tests: redirects.test.ts, api.test.tsx, LoginPage.test.tsx, RegisterPage.test.tsx, AccountNav.test.tsx
```

---

### Task 1: Auth API

**Files:**
- Create: `api/app/auth/serializers.py`
- Modify: `api/app/auth/routes.py`
- Test: `api/tests/test_auth.py`

**Interfaces:**
- Consumes: `json_body`, `required_text`, `log_in`, `log_out`, `current_user`, `ValidationError`, `Unauthorized`, `Conflict`, `User`, fixtures `client` and `make_user`
- Produces: `user_payload(user) -> {"id", "username", "email"}`, `public_user(user) -> {"username"}`, and the four `/api/auth` routes from the index

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b slice/05-auth
cd api
```

- [ ] **Step 2: Write the failing tests**

`api/tests/test_auth.py`:

```python
from unittest.mock import ANY

import pytest

from app.auth.serializers import public_user

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"
USERNAME_RULE = "Username must be 3 to 30 lowercase letters, numbers, or underscores"
PASSWORD_RULE = "Password must be 8 to 128 characters"


def _register(client, **overrides):
    body = {
        "email": " Alice@Example.com ",
        "username": " Alice_1 ",
        "password": "password123",
        **overrides,
    }
    return client.post(REGISTER, json=body)


def test_register_normalizes_and_logs_in(client):
    response = _register(client)

    assert response.status_code == 201
    assert response.json == {
        "user": {"id": ANY, "username": "alice_1", "email": "alice@example.com"}
    }
    assert client.get("/api/auth/me").json["user"]["username"] == "alice_1"


def test_register_sets_an_http_only_lax_session_cookie(client):
    cookie = _register(client).headers["Set-Cookie"]

    assert cookie.startswith("session=")
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"email": "  "}, "Email is required"),
        ({"email": "not-an-email"}, "Enter a valid email address"),
        ({"username": "ab"}, USERNAME_RULE),
        ({"username": "has space"}, USERNAME_RULE),
        ({"username": "x" * 31}, "Username must be 30 characters or fewer"),
        ({"password": "short"}, PASSWORD_RULE),
        ({"password": "x" * 129}, PASSWORD_RULE),
        ({"password": 12345678}, PASSWORD_RULE),
    ],
)
def test_register_validates(client, overrides, message):
    response = _register(client, **overrides)

    assert response.status_code == 422
    assert response.json["error"] == {"code": "validation_error", "message": message}


def test_register_requires_a_json_object(client):
    assert client.post(REGISTER, json=["alice"]).status_code == 422


def test_register_rejects_a_taken_email(client, make_user):
    make_user("alice")

    response = _register(client, username="someone_else")

    assert response.status_code == 409
    assert response.json["error"] == {"code": "conflict", "message": "Email is already registered"}


def test_register_rejects_a_taken_username(client, make_user):
    make_user("alice_1")

    response = _register(client, email="other@example.com")

    assert response.status_code == 409
    assert response.json["error"] == {"code": "conflict", "message": "Username is taken"}


def test_login_ignores_email_case(client, make_user):
    make_user("alice")

    response = client.post(LOGIN, json={"email": "ALICE@example.com", "password": "password123"})

    assert response.status_code == 200
    assert response.json["user"]["username"] == "alice"


@pytest.mark.parametrize(
    "body",
    [
        {"email": "alice@example.com", "password": "wrong-password"},
        {"email": "nobody@example.com", "password": "password123"},
    ],
)
def test_login_hides_which_part_was_wrong(client, make_user, body):
    make_user("alice")

    response = client.post(LOGIN, json=body)

    assert response.status_code == 401
    assert response.json["error"] == {
        "code": "unauthorized",
        "message": "Email or password is incorrect",
    }


def test_logout_clears_the_session(client, make_user):
    make_user("alice")
    client.post(LOGIN, json={"email": "alice@example.com", "password": "password123"})

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").json == {"user": None}


def test_me_is_null_when_logged_out(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json == {"user": None}


def test_public_user_hides_email(make_user):
    assert public_user(make_user("alice")) == {"username": "alice"}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_auth.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.auth.serializers'`

- [ ] **Step 4: Write the implementation**

`api/app/auth/serializers.py`:

```python
from app.models import User


def user_payload(user: User) -> dict:
    return {"id": user.id, "username": user.username, "email": user.email}


def public_user(user: User) -> dict:
    return {"username": user.username}
```

Replace `api/app/auth/routes.py`:

```python
import re

from flask import Blueprint
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from app.auth.serializers import user_payload
from app.auth.session import current_user, log_in, log_out
from app.errors import Conflict, Unauthorized, ValidationError
from app.extensions import db
from app.http import json_body, required_text
from app.models import User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME = re.compile(r"^[a-z0-9_]{3,30}$")
USERNAME_RULE = "Username must be 3 to 30 lowercase letters, numbers, or underscores"
CONFLICTS = {
    "uq_users_email": "Email is already registered",
    "uq_users_username": "Username is taken",
}


def _email(data: dict) -> str:
    email = required_text(data, "email", 254).lower()
    if not EMAIL.match(email):
        raise ValidationError("Enter a valid email address")
    return email


def _username(data: dict) -> str:
    username = required_text(data, "username", 30).lower()
    if not USERNAME.match(username):
        raise ValidationError(USERNAME_RULE)
    return username


# passwords are never trimmed, spaces are valid characters
def _password(data: dict) -> str:
    password = data.get("password")
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        raise ValidationError("Password must be 8 to 128 characters")
    return password


@bp.post("/register")
def register():
    data = json_body()
    user = User(
        email=_email(data),
        username=_username(data),
        password_hash=generate_password_hash(_password(data)),
    )
    db.session.add(user)
    # the unique constraints decide, so two signups racing for one name cannot both win
    try:
        db.session.commit()
    except IntegrityError as error:
        db.session.rollback()
        raise Conflict(CONFLICTS[error.orig.diag.constraint_name]) from error
    log_in(user)
    return {"user": user_payload(user)}, 201


@bp.post("/login")
def login():
    data = json_body()
    email = required_text(data, "email", 254).lower()
    password = data.get("password")
    user = db.session.scalar(select(User).filter_by(email=email))
    if (
        user is None
        or not isinstance(password, str)
        or not check_password_hash(user.password_hash, password)
    ):
        raise Unauthorized("Email or password is incorrect")
    log_in(user)
    return {"user": user_payload(user)}


@bp.post("/logout")
def logout():
    log_out()
    return "", 204


@bp.get("/me")
def me():
    user = current_user()
    return {"user": user_payload(user) if user else None}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_auth.py -v`
Expected: 19 passed

Then run `pytest` to confirm nothing else broke.

- [ ] **Step 6: Lint, format, commit, and open the early pull request**

```bash
ruff format . && ruff check .
git add app/auth tests/test_auth.py
git commit -m "feat(api): add register, login, logout, and me routes"
git push -u origin slice/05-auth
gh pr create --base main --title "Auth: API" --body "Task 1 of slice 05, unblocks slices 07 and 08"
```

### Task 2: Session mutations, safe redirects, and 401 handling

**Files:**
- Create: `web/src/features/auth/redirects.ts`, `web/src/features/auth/api.ts`, `web/src/features/auth/useUnauthorizedRedirect.ts`
- Test: `web/src/features/auth/redirects.test.ts`, `web/src/features/auth/api.test.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError`, `User`, `mockFetch`, `renderWithProviders`
- Produces:
  - `safeNext(next: string | null): string | null` returns `next` only for same-site paths
  - `authHref(path: "/login" | "/register", next: string | null): string`
  - `loginHref(next: string): string`, which slices 07 and 08 use for "Log in to rate" style links
  - `useLogin()`, `useRegister()`, and `useLogout()` mutations
  - `useUnauthorizedRedirect()`. Any mutation failing with 401 sets `["me"]` to `{user: null}` and navigates to `loginHref(current path and search)`. Mutations that expect a 401, like login, opt out with `meta: { expectsUnauthorized: true }`

The 401 hook reads the client through `useQueryClient` and runs inside `AppShell`, so `queryClient.ts` never imports the router, and tests that use a fresh `QueryClient` exercise the same code.

- [ ] **Step 1: Write the failing tests**

Web tasks run from `web/`, so `cd ../web` first.

`web/src/features/auth/redirects.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { authHref, loginHref, safeNext } from "./redirects";

describe("redirects", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/albums/abc?page=2")).toBe("/albums/abc?page=2");
  });

  it("drops anything that could leave the site", () => {
    for (const next of [null, "", "albums", "//evil.com", "/\\evil.com", "https://evil.com"]) {
      expect(safeNext(next)).toBeNull();
    }
  });

  it("carries next through auth links", () => {
    expect(authHref("/register", "/songs/x?y=1")).toBe("/register?next=%2Fsongs%2Fx%3Fy%3D1");
    expect(authHref("/login", null)).toBe("/login");
    expect(loginHref("/playlists/3")).toBe("/login?next=%2Fplaylists%2F3");
  });
});
```

`web/src/features/auth/api.test.tsx`:

```tsx
import { useMutation } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { api } from "../../api/client";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { useLogout } from "./api";
import { useUnauthorizedRedirect } from "./useUnauthorizedRedirect";

const UNAUTHORIZED = {
  status: 401,
  body: { error: { code: "unauthorized", message: "Log in to continue" } },
};

function SaveHarness({ expectsUnauthorized = false }: { expectsUnauthorized?: boolean }) {
  useUnauthorizedRedirect();
  const save = useMutation({
    mutationFn: () => api.post("/playlists"),
    meta: { expectsUnauthorized },
  });
  return <button onClick={() => save.mutate()}>Save</button>;
}

function LogoutHarness() {
  const logout = useLogout();
  return <button onClick={() => logout.mutate()}>Log out</button>;
}

describe("auth data layer", () => {
  it("sends a 401 write to login and back", async () => {
    mockFetch({ "POST /api/playlists": UNAUTHORIZED });
    const { router, queryClient } = renderWithProviders(<SaveHarness />, {
      path: "/playlists/1?tab=songs",
    });

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe("?next=%2Fplaylists%2F1%3Ftab%3Dsongs");
    expect(queryClient.getQueryData(["me"])).toEqual({ user: null });
  });

  it("leaves expected 401s to the form", async () => {
    const fetchMock = mockFetch({ "POST /api/playlists": UNAUTHORIZED });
    const { router } = renderWithProviders(<SaveHarness expectsUnauthorized />, {
      path: "/login",
    });

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(router.state.location.search).toBe("");
  });

  it("clears user data on logout", async () => {
    mockFetch({ "POST /api/auth/logout": { status: 204 } });
    const { queryClient } = renderWithProviders(<LogoutHarness />);
    queryClient.setQueryData(["me"], { user: { id: 1, username: "alice", email: "a@b.co" } });
    queryClient.setQueryData(["playlists", "alice"], { items: [] });

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(queryClient.getQueryData(["me"])).toEqual({ user: null }));
    expect(queryClient.getQueryData(["playlists", "alice"])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/auth`
Expected: FAIL, cannot resolve `./redirects` and `./api`

- [ ] **Step 3: Write the implementation**

`web/src/features/auth/redirects.ts`:

```ts
// a single leading slash keeps the redirect on this site, // and /\ are read as other hosts
export function safeNext(next: string | null): string | null {
  return next && /^\/(?![/\\])/.test(next) ? next : null;
}

export function authHref(path: "/login" | "/register", next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export function loginHref(next: string): string {
  return authHref("/login", next);
}
```

`web/src/features/auth/api.ts`:

```ts
import { type Query, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { User } from "../../api/types";

interface Credentials {
  email: string;
  password: string;
}

interface Registration extends Credentials {
  username: string;
}

interface MeResponse {
  user: User | null;
}

const isNotMe = (query: Query) => query.queryKey[0] !== "me";

function useSessionMutation<T>(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: T) => api.post<MeResponse>(path, body),
    // a wrong password is a form error, not an expired session
    meta: { expectsUnauthorized: true },
    onSuccess: (data) => {
      queryClient.setQueryData<MeResponse>(["me"], data);
      // pages cached while logged out lack this user's ratings
      void queryClient.invalidateQueries({ predicate: isNotMe });
    },
  });
}

export function useLogin() {
  return useSessionMutation<Credentials>("/auth/login");
}

export function useRegister() {
  return useSessionMutation<Registration>("/auth/register");
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/auth/logout"),
    onSuccess: () => {
      queryClient.removeQueries({ predicate: isNotMe });
      queryClient.setQueryData<MeResponse>(["me"], { user: null });
    },
  });
}
```

`web/src/features/auth/useUnauthorizedRedirect.ts`:

```ts
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { ApiError } from "../../api/client";
import { loginHref } from "./redirects";

// any write that fails with 401, like an expired session, goes to login and comes back
export function useUnauthorizedRedirect() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "error") return;
        const { error } = event.action;
        if (!(error instanceof ApiError) || error.status !== 401) return;
        if (event.mutation.options.meta?.expectsUnauthorized) return;
        queryClient.setQueryData(["me"], { user: null });
        navigate(loginHref(pathname + search));
      }),
    [queryClient, navigate, pathname, search],
  );
}
```

`subscribe` returns its unsubscribe function, so the effect cleans up after itself on every location change.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/auth`
Expected: 6 passed

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/features/auth
git commit -m "feat(web): add session mutations, safe redirects, and 401 handling"
```

### Task 3: Login and register pages

**Files:**
- Create: `web/src/features/auth/AuthLayout.tsx`, `web/src/features/auth/auth.module.css`
- Create: `web/src/features/auth/LoginPage.tsx`, `web/src/features/auth/RegisterPage.tsx`
- Modify: `web/src/features/auth/routes.ts`
- Test: `web/src/features/auth/LoginPage.test.tsx`, `web/src/features/auth/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: Task 2, `useMe`, `errorMessage`, `Card`, `PageHeader`, `TextField`, `Button`
- Produces: routes `/login` and `/register` in `authRoutes`. Both honor `?next=` through `safeNext` and fall back to `/search`. A logged-in visitor is redirected straight there.

Success needs no navigation code. The mutation writes `["me"]`, the page re-renders with a user, and the same `<Navigate>` that handles an already logged-in visitor takes over.

- [ ] **Step 1: Write the failing tests**

`web/src/features/auth/LoginPage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";

const ALICE = { id: 1, username: "alice", email: "alice@example.com" };

async function submitLogin() {
  await userEvent.type(await screen.findByLabelText("Email"), "alice@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "password123");
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginPage", () => {
  it("logs in and returns to the next page", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: null } },
      "POST /api/auth/login": { body: { user: ALICE } },
    });
    const { router } = renderAt("/login?next=/somewhere");

    await submitLogin();

    await waitFor(() => expect(router.state.location.pathname).toBe("/somewhere"));
  });

  it("ignores a next that leaves the site", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: null } },
      "POST /api/auth/login": { body: { user: ALICE } },
    });
    const { router } = renderAt("/login?next=//evil.com");

    await submitLogin();

    await waitFor(() => expect(router.state.location.pathname).toBe("/search"));
  });

  it("shows the server error and stays on the page", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: null } },
      "POST /api/auth/login": {
        status: 401,
        body: { error: { code: "unauthorized", message: "Email or password is incorrect" } },
      },
    });
    const { router } = renderAt("/login");

    await submitLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
    expect(router.state.location.pathname).toBe("/login");
  });
});
```

`web/src/features/auth/RegisterPage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";

async function submitRegistration() {
  await userEvent.type(await screen.findByLabelText("Email"), "alice@example.com");
  await userEvent.type(screen.getByLabelText("Username"), "alice");
  await userEvent.type(screen.getByLabelText("Password"), "password123");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("RegisterPage", () => {
  it("creates the account and lands on search", async () => {
    const fetchMock = mockFetch({
      "GET /api/auth/me": { body: { user: null } },
      "POST /api/auth/register": (body) => ({
        status: 201,
        body: { user: { id: 1, ...(body as { email: string; username: string }) } },
      }),
    });
    const { router } = renderAt("/register");

    await submitRegistration();

    await waitFor(() => expect(router.state.location.pathname).toBe("/search"));
    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/auth/register")!;
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "alice@example.com",
      username: "alice",
      password: "password123",
    });
  });

  it("shows a taken username", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: null } },
      "POST /api/auth/register": {
        status: 409,
        body: { error: { code: "conflict", message: "Username is taken" } },
      },
    });
    renderAt("/register");

    await submitRegistration();

    expect(await screen.findByRole("alert")).toHaveTextContent("Username is taken");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/auth/LoginPage.test.tsx src/features/auth/RegisterPage.test.tsx`
Expected: FAIL, the email field is never found because `/login` and `/register` render the not found page

- [ ] **Step 3: Write the implementation**

`web/src/features/auth/AuthLayout.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card, PageHeader } from "../../ui";
import styles from "./auth.module.css";

interface AuthLayoutProps {
  title: string;
  error: string | null;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ title, error, footer, children }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <PageHeader title={title} />
      <Card>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {children}
      </Card>
      <p className={styles.footer}>{footer}</p>
    </div>
  );
}
```

`web/src/features/auth/auth.module.css`:

```css
.page {
  max-width: 28rem;
  margin: 0 auto;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.submit {
  width: 100%;
  margin-top: var(--space-2);
}

.error {
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  color: var(--color-danger);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

.footer {
  margin-top: var(--space-6);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
  text-align: center;
}

.footer a {
  color: var(--color-accent);
  font-weight: 600;
}
```

`web/src/features/auth/LoginPage.tsx`:

```tsx
import type { FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { errorMessage } from "../../api/client";
import { Button, TextField } from "../../ui";
import { useLogin } from "./api";
import { AuthLayout } from "./AuthLayout";
import styles from "./auth.module.css";
import { authHref, safeNext } from "./redirects";
import { useMe } from "./useMe";

export function LoginPage() {
  const { user } = useMe();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const login = useLogin();

  if (user) return <Navigate to={next ?? "/search"} replace />;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate({ email: String(form.get("email")), password: String(form.get("password")) });
  };

  return (
    <AuthLayout
      title="Log in"
      error={login.isError ? errorMessage(login.error) : null}
      footer={
        <>
          New to TrackmyTracks? <Link to={authHref("/register", next)}>Create an account</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" variant="primary" loading={login.isPending} className={styles.submit}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
```

`web/src/features/auth/RegisterPage.tsx`:

```tsx
import type { FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { errorMessage } from "../../api/client";
import { Button, TextField } from "../../ui";
import { useRegister } from "./api";
import { AuthLayout } from "./AuthLayout";
import styles from "./auth.module.css";
import { authHref, safeNext } from "./redirects";
import { useMe } from "./useMe";

export function RegisterPage() {
  const { user } = useMe();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const register = useRegister();

  if (user) return <Navigate to={next ?? "/search"} replace />;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    register.mutate({
      email: String(form.get("email")),
      username: String(form.get("username")),
      password: String(form.get("password")),
    });
  };

  return (
    <AuthLayout
      title="Create an account"
      error={register.isError ? errorMessage(register.error) : null}
      footer={
        <>
          Already have an account? <Link to={authHref("/login", next)}>Log in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Username"
          name="username"
          autoComplete="username"
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_]+"
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
        <Button
          type="submit"
          variant="primary"
          loading={register.isPending}
          className={styles.submit}
        >
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
```

The username pattern accepts capitals because the API lowercases them.

Replace `web/src/features/auth/routes.ts`:

```ts
import type { RouteObject } from "react-router";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";

export const authRoutes: RouteObject[] = [
  { path: "/login", Component: LoginPage },
  { path: "/register", Component: RegisterPage },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/auth`
Expected: 11 passed

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/features/auth
git commit -m "feat(web): add login and register pages"
```

### Task 4: Account navigation in the header

**Files:**
- Create: `web/src/features/auth/AccountNav.tsx`, `web/src/features/auth/AccountNav.module.css`
- Modify: `web/src/app/AppShell.tsx`, `web/src/app/AppShell.module.css`
- Test: `web/src/features/auth/AccountNav.test.tsx`

**Interfaces:**
- Consumes: `useMe`, `useLogout`, `useUnauthorizedRedirect`, `Button`, `buttonClassName`, `cx`
- Produces: `AccountNav` mounted after the main `nav` in `AppShell`. `AppShell` now calls `useUnauthorizedRedirect()` once for the whole app.

- [ ] **Step 1: Write the failing tests**

`web/src/features/auth/AccountNav.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { AccountNav } from "./AccountNav";

describe("AccountNav", () => {
  it("offers log in and sign up when logged out", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    renderWithProviders(<AccountNav />);

    expect(await screen.findByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/register");
  });

  it("links the user's pages and logs out", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: { id: 1, username: "alice", email: "a@b.co" } } },
      "POST /api/auth/logout": { status: 204 },
    });
    renderWithProviders(<AccountNav />);

    expect(await screen.findByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/users/alice/history",
    );
    expect(screen.getByRole("link", { name: "Playlists" })).toHaveAttribute(
      "href",
      "/users/alice/playlists",
    );

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("link", { name: "Log in" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/auth/AccountNav.test.tsx`
Expected: FAIL, cannot resolve `./AccountNav`

- [ ] **Step 3: Write the implementation**

`web/src/features/auth/AccountNav.tsx`:

```tsx
import { Link, NavLink } from "react-router";
import { Button, buttonClassName, cx } from "../../ui";
import { useLogout } from "./api";
import styles from "./AccountNav.module.css";
import { useMe } from "./useMe";

const navClassName = ({ isActive }: { isActive: boolean }) => cx(styles.link, isActive && styles.active);

export function AccountNav() {
  const { user, isLoading } = useMe();
  const logout = useLogout();

  // nothing until the session is known, so the header never flashes the wrong state
  if (isLoading) return null;

  if (!user) {
    return (
      <div className={styles.account}>
        <Link to="/login" className={buttonClassName("ghost")}>
          Log in
        </Link>
        <Link to="/register" className={buttonClassName("primary")}>
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.account}>
      <nav aria-label="Account" className={styles.links}>
        <NavLink to={`/users/${user.username}/history`} className={navClassName}>
          History
        </NavLink>
        <NavLink to={`/users/${user.username}/playlists`} className={navClassName}>
          Playlists
        </NavLink>
      </nav>
      <span className={styles.username}>{user.username}</span>
      <Button variant="ghost" loading={logout.isPending} onClick={() => logout.mutate()}>
        Log out
      </Button>
    </div>
  );
}
```

`web/src/features/auth/AccountNav.module.css`:

```css
.account {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
}

.links {
  display: flex;
  gap: var(--space-4);
}

.link {
  composes: link from "../../app/AppShell.module.css";
}

.active {
  composes: active from "../../app/AppShell.module.css";
}

.username {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
}

@media (max-width: 640px) {
  .username {
    display: none;
  }
}
```

`composes` reuses the shell's nav link style, so both navs stay identical without a second copy of the rules.

Replace `web/src/app/AppShell.tsx`:

```tsx
import { Link, NavLink, Outlet } from "react-router";
import { AccountNav } from "../features/auth/AccountNav";
import { useUnauthorizedRedirect } from "../features/auth/useUnauthorizedRedirect";
import { cx } from "../ui";
import styles from "./AppShell.module.css";

const navClassName = ({ isActive }: { isActive: boolean }) => cx(styles.link, isActive && styles.active);

export function AppShell() {
  useUnauthorizedRedirect();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <nav className={styles.nav} aria-label="Main">
            <Link to="/" className={styles.brand}>
              TrackmyTracks
            </Link>
            <NavLink to="/search" className={navClassName}>
              Search
            </NavLink>
          </nav>
          <AccountNav />
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={styles.bar}>
          <p className={styles.brand}>TrackmyTracks</p>
          <p className={styles.tagline}>Rate it. Review it. Replay it.</p>
        </div>
      </footer>
    </>
  );
}
```

In `web/src/app/AppShell.module.css`, add `flex-wrap: wrap;` to `.bar` so the account controls drop below the brand on narrow screens:

```css
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  max-width: var(--content-width);
  margin: 0 auto;
  padding: var(--space-3) var(--space-6);
}
```

- [ ] **Step 4: Run every check**

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, including `src/app/router.test.tsx` from slice 03, lint reports no errors, and the build succeeds.

- [ ] **Step 5: See it end to end**

With `flask run` and `npm run dev` both running, open `http://localhost:5173/register`.

Expected:
- The header shows Log in and Sign up.
- Creating an account lands on `/search`, and the header switches to History, Playlists, your username, and Log out.
- Log out flips the header back without a page reload.
- Visiting `/login?next=//evil.com` and logging in lands on `/search`.
- At 375px wide the account controls wrap under the wordmark, the username hides, and nothing overflows.

- [ ] **Step 6: Commit, push, and update the pull request**

```bash
git add src/features/auth src/app
git commit -m "feat(web): add account navigation and mount 401 redirect"
git push
gh pr create --fill --base main
```

If the Task 1 pull request already merged, `gh pr create` opens a new one for the web tasks. Otherwise the push updates the open one.
