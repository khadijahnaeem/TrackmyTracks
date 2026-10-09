import { http, type HttpHandler } from "msw";
import { conflict, created, invalid, jsonBody, noContent, requiredText, route, unauthorized } from "../respond";
import { currentUser, findUserByName, logIn, logOut, nextId, state, userPayload } from "../store";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

function emailOf(data: Record<string, unknown>): string {
  return requiredText(data, "email", 254).toLowerCase();
}

function passwordOf(data: Record<string, unknown>): string {
  const { password } = data;
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw invalid("Password must be 8 to 128 characters");
  }
  return password;
}

export const authHandlers: HttpHandler[] = [
  http.post(
    "/api/auth/register",
    route(async ({ request }) => {
      const data = await jsonBody(request);
      const email = emailOf(data);
      if (!EMAIL_PATTERN.test(email)) throw invalid("Enter a valid email address");
      const username = requiredText(data, "username", 30).toLowerCase();
      if (!USERNAME_PATTERN.test(username)) {
        throw invalid("Username must be 3 to 30 lowercase letters, numbers, or underscores");
      }
      const password = passwordOf(data);
      if (state().users.some((user) => user.email === email)) throw conflict("Email is already registered");
      if (findUserByName(username)) throw conflict("Username is taken");

      const user = { id: nextId(), email, username, password };
      state().users.push(user);
      logIn(user);
      return created({ user: userPayload(user) });
    }),
  ),

  http.post(
    "/api/auth/login",
    route(async ({ request }) => {
      const data = await jsonBody(request);
      const email = emailOf(data);
      const user = state().users.find((row) => row.email === email);
      if (!user || user.password !== data.password) throw unauthorized("Email or password is incorrect");
      logIn(user);
      return { user: userPayload(user) };
    }),
  ),

  http.post(
    "/api/auth/logout",
    route(() => {
      logOut();
      return noContent();
    }),
  ),

  http.get(
    "/api/auth/me",
    route(() => {
      const user = currentUser();
      return { user: user ? userPayload(user) : null };
    }),
  ),
];
