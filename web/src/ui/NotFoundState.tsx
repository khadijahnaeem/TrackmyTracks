import { Notice } from "./Notice";
import { PageHeader } from "./PageHeader";
import { SearchLink } from "./SearchLink";

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
      <Notice title={noticeTitle} action={<SearchLink />}>
        {message}
      </Notice>
    </>
  );
}
