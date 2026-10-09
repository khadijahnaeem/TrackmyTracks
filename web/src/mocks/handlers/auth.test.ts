import { expect, test } from "vitest";
import type { User } from "../../api/types";
import { DEMO_LOGIN } from "../seed";
import { call, useMockServer } from "../testing";
import { authHandlers } from "./auth";

useMockServer(...authHandlers);

const newcomer = { email: "New@Example.com", username: "Newcomer", password: "long enough" };

test("register logs in and answers 201", async () => {
  const registered = await call<{ user: User }>("POST", "/auth/register", newcomer);
  expect(registered.status).toBe(201);
  expect(registered.body.user).toMatchObject({ username: "newcomer", email: "new@example.com" });
  expect(await call("GET", "/auth/me")).toEqual({ status: 200, body: { user: registered.body.user } });
});

test("register rejects a taken username", async () => {
  const taken = await call("POST", "/auth/register", { ...newcomer, username: "demo" });
  expect(taken).toEqual({
    status: 409,
    body: { error: { code: "conflict", message: "Username is taken" } },
  });
});

test("register rejects a taken email before a taken username", async () => {
  const taken = await call("POST", "/auth/register", { ...newcomer, email: DEMO_LOGIN.email, username: "demo" });
  expect(taken.body).toEqual({ error: { code: "conflict", message: "Email is already registered" } });
});

test("register validates the username rule", async () => {
  const short = await call("POST", "/auth/register", { ...newcomer, username: "Al" });
  expect(short.status).toBe(422);
  expect(short.body).toEqual({
    error: {
      code: "validation_error",
      message: "Username must be 3 to 30 lowercase letters, numbers, or underscores",
    },
  });
});

test("register validates the email and password", async () => {
  const email = await call("POST", "/auth/register", { ...newcomer, email: "nope" });
  expect(email.body).toMatchObject({ error: { message: "Enter a valid email address" } });
  const password = await call("POST", "/auth/register", { ...newcomer, password: "short" });
  expect(password.body).toMatchObject({ error: { message: "Password must be 8 to 128 characters" } });
});

test("a body that is not an object is rejected", async () => {
  const bad = await call("POST", "/auth/login", ["demo"]);
  expect(bad.body).toMatchObject({ error: { message: "Request body must be a JSON object" } });
});

test("a failed registration leaves no user behind", async () => {
  await call("POST", "/auth/register", { ...newcomer, password: "short" });
  expect(await call("GET", "/auth/me")).toEqual({ status: 200, body: { user: null } });
});

test("login with the demo account works", async () => {
  const login = await call<{ user: User }>("POST", "/auth/login", DEMO_LOGIN);
  expect(login.status).toBe(200);
  expect(login.body.user.username).toBe("demo");
});

test("a wrong password is unauthorized", async () => {
  const login = await call("POST", "/auth/login", { ...DEMO_LOGIN, password: "wrong-password" });
  expect(login).toEqual({
    status: 401,
    body: { error: { code: "unauthorized", message: "Email or password is incorrect" } },
  });
});

test("logout clears the session", async () => {
  await call("POST", "/auth/login", DEMO_LOGIN);
  expect(await call("POST", "/auth/logout")).toEqual({ status: 204, body: undefined });
  expect(await call("GET", "/auth/me")).toEqual({ status: 200, body: { user: null } });
});
