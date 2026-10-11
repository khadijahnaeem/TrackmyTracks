import type { ReactNode } from "react";
import { Link } from "react-router";
import { buttonClassName } from "./buttonClassName";

export function SearchLink({ children = "Search music" }: { children?: ReactNode }) {
  return (
    <Link to="/search" className={buttonClassName("primary")}>
      {children}
    </Link>
  );
}
