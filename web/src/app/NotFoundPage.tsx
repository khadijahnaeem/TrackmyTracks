import { Link } from "react-router";
import { buttonClassName, Notice, PageHeader } from "../ui";

export function NotFoundPage() {
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
