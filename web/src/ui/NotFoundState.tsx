import { Link } from "react-router";
import { buttonClassName } from "./buttonClassName";
import { Notice } from "./Notice";
import { PageHeader } from "./PageHeader";

export function NotFoundState() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Notice
        title="Nothing lives at this address"
        action={
          <Link to="/search" className={buttonClassName("primary")}>
            Search music
          </Link>
        }
      >
        The link may be broken, or the page may have moved.
      </Notice>
    </>
  );
}
