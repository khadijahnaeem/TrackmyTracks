import { useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { isNotFound } from "../../api/client";
import type { HistoryEntry, Kind } from "../../api/types";
import {
  buttonClassName,
  cx,
  ErrorNotice,
  formatDate,
  Notice,
  NotFoundState,
  PageHeader,
  Pagination,
  pluralize,
  SegmentedControl,
  Skeleton,
  Stars,
} from "../../ui";
import { useMe } from "../auth/useMe";
import { useHistory } from "./api";
import styles from "./HistoryPage.module.css";

type Filter = Kind | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "song", label: "Songs" },
  { value: "album", label: "Albums" },
  { value: "artist", label: "Artists" },
];

function parseKind(value: string | null): Kind | null {
  const match = FILTERS.find((filter) => filter.value === value)?.value;
  return match && match !== "all" ? match : null;
}

export function HistoryPage() {
  const { username = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = parseKind(searchParams.get("kind"));
  const pageValue = Number(searchParams.get("page"));
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const { user, isLoading: meLoading } = useMe();
  const isOwn = user?.username === username;
  const history = useHistory(username, kind, page);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusResults = useRef(false);

  // focus the results heading once a page change from the pagination control settles
  useEffect(() => {
    if (focusResults.current && !history.isPlaceholderData) {
      focusResults.current = false;
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [history.isPlaceholderData, history.data, history.isError]);

  if (isNotFound(history.error)) {
    return (
      <NotFoundState
        title="User not found"
        noticeTitle={`No user named ${username}`}
        message="Check the spelling in the address."
      />
    );
  }
  if (history.isError) {
    return (
      <>
        <PageHeader eyebrow="History" title={username} />
        <ErrorNotice error={history.error} title="Could not load this history" onRetry={() => history.refetch()} />
      </>
    );
  }

  const { data } = history;
  const loading = meLoading || !data;
  const refreshing = history.isPlaceholderData;

  const handlePageChange = (next: number) => {
    focusResults.current = true;
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set("page", String(next));
      return params;
    });
  };

  // a new filter always starts from the first page
  const handleKindChange = (next: Filter) => setSearchParams(next === "all" ? {} : { kind: next });

  return (
    <>
      {loading ? <LoadingHeader /> : <PageHeader eyebrow="History" title={isOwn ? "Your history" : username} />}
      <div className={styles.filters}>
        <SegmentedControl label="Filter by kind" options={FILTERS} value={kind ?? "all"} onChange={handleKindChange} />
      </div>
      <p role="status" className="visually-hidden">
        {data && !refreshing ? settledStatus(data.total, data.pages, page) : ""}
      </p>
      {loading ? (
        <HistorySkeleton />
      ) : (
        <>
          <h2 ref={headingRef} tabIndex={-1} className="visually-hidden">
            Results
          </h2>
          {data.items.length === 0 ? (
            <EmptyHistory username={username} isOwn={isOwn} kind={kind} />
          ) : (
            <>
              <ul className={cx(styles.list, refreshing && styles.refreshing)} aria-busy={refreshing || undefined}>
                {data.items.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))}
              </ul>
              <Pagination
                page={page}
                pages={data.pages}
                onPageChange={handlePageChange}
                disabled={refreshing}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

function settledStatus(total: number, pages: number, page: number): string {
  return `${pluralize(total, "rating")}${pages > 1 ? `, page ${page} of ${pages}` : ""}`;
}

function LoadingHeader() {
  return (
    <div className={styles.loadingHeader}>
      <title>Loading | TrackmyTracks</title>
      <Skeleton width="4rem" height="var(--leading-xs)" />
      <Skeleton width="min(16rem, 60%)" height="var(--leading-3xl)" />
    </div>
  );
}

function HistorySkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading history" className={styles.list}>
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className={styles.row}>
          <div className={styles.main}>
            <Skeleton width="4rem" height="var(--leading-xs)" />
            <Skeleton width="14rem" />
          </div>
          <Skeleton width="5rem" height="var(--space-4)" />
        </li>
      ))}
    </ul>
  );
}

interface EmptyHistoryProps {
  username: string;
  isOwn: boolean;
  kind: Kind | null;
}

function EmptyHistory({ username, isOwn, kind }: EmptyHistoryProps) {
  if (!isOwn) {
    return <Notice title={kind ? `${username} has no ${kind} ratings yet` : `${username} has not rated anything yet`} />;
  }
  return (
    <Notice
      title={kind ? `No ${kind} ratings yet` : "Nothing rated yet"}
      action={
        <Link to="/search" className={buttonClassName("primary")}>
          Search music
        </Link>
      }
    >
      Songs, albums, and artists you rate show up here.
    </Notice>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { item } = entry;
  const title = "name" in item ? item.name : item.title;
  const artist = "artist" in item ? item.artist : null;

  return (
    <li className={styles.row}>
      <div className={styles.main}>
        <p className={styles.kind}>{entry.kind}</p>
        <Link to={`/${entry.kind}s/${item.mbid}`} className={styles.title}>
          {title}
        </Link>
        {artist && (
          <Link to={`/artists/${artist.mbid}`} className={styles.artist}>
            {artist.name}
          </Link>
        )}
        {entry.review && <p className={styles.review}>{entry.review}</p>}
      </div>
      <div className={styles.meta}>
        <Stars value={entry.stars} label="Rating" size="sm" />
        <time dateTime={entry.updated_at} className={styles.date}>
          {formatDate(entry.updated_at)}
        </time>
      </div>
    </li>
  );
}
