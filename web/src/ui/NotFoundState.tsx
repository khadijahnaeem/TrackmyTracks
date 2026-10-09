import { Link } from "react-router";
import { buttonClassName } from "./buttonClassName";
import { Notice } from "./Notice";
import { PageHeader } from "./PageHeader";

interface NotFoundStateProps {
  title?: string;
  noticeTitle?: string;
  message?: string;
}

export function NotFoundState({
  title = "Page not found",
  noticeTitle = "Nothing lives at this address",
  message = "The link may be broken, or the page may have moved.",
}: NotFoundStateProps) {
  return (
    <>
      <PageHeader title={title} />
      <Notice
        title={noticeTitle}
        action={
          <Link to="/search" className={buttonClassName("primary")}>
            Search music
          </Link>
        }
      >
        {message}
      </Notice>
    </>
  );
}
