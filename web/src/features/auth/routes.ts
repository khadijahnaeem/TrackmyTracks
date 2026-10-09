import type { RouteObject } from "react-router";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";

export const authRoutes: RouteObject[] = [
  { path: "/login", Component: LoginPage },
  { path: "/register", Component: RegisterPage },
];
