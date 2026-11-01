import type { UseQueryResult } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Link } from "react-router";
import type { FeedEntry, Page } from "../../api/types";
import { buttonClassName, Card, ErrorNotice, formatDate, Notice, Pagination, Skeleton, Stars } from "../../ui";
import styles from "../home/HomePage.module.css";
import { SectionHeading } from "../home/SectionHeading";
import { useFeed, useRecentReviews } from "./api";

const KIND_LABELS = { album: "Album", artist: "Artist" } as const;

export function FriendsActivity() {
  const headingId = useId();
  const [page, setPage] = useState(1);
  const [recentPage, setRecentPage] = useState(1);
  const feed = useFeed(page);
  const feedEmpty = page === 1 && feed.data?.items.length === 0;
  const recent = useRecentReviews(recentPage, feedEmpty);
  const showCommunity = feedEmpty && (recent.isError || (recent.data?.items.length ?? 0) > 0);

  if (showCommunity) {
    return (
      <section aria-labelledby={headingId}>
        <SectionHeading id={headingId} eyebrow="The community" title="Fresh Reviews" />
        <p className={`${styles.muted} ${styles.addFriends}`}>
          <Link to="/friends">Add friends to see their activity here</Link>
        </p>
        <ActivityList query={recent} page={recentPage} onPageChange={setRecentPage} errorTitle="Could not load reviews" />
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} eyebrow="Your friends" title="Friends' Activity" />
      {feedEmpty && recent.isPending ? (
        <Skeleton height="var(--space-16)" />
      ) : feedEmpty ? (
        <Notice
          title="Nothing from friends yet"
          action={
            <Link to="/friends" className={buttonClassName("secondary")}>
              Find friends
            </Link>
          }
        >
          Ratings from your friends show up here.
        </Notice>
      ) : (
        <ActivityList query={feed} page={page} onPageChange={setPage} errorTitle="Could not load friends' activity" />
      )}
    </section>
  );
}

interface ActivityListProps {
  query: UseQueryResult<Page<FeedEntry>>;
  page: number;
  onPageChange: (page: number) => void;
  errorTitle: string;
}

function ActivityList({ query, page, onPageChange, errorTitle }: ActivityListProps) {
  const { data } = query;
  if (query.isError) return <ErrorNotice error={query.error} title={errorTitle} onRetry={() => query.refetch()} />;
  if (!data) return <Skeleton height="var(--space-16)" />;
  return (
    <>
      <ul className={styles.reviews} aria-busy={query.isPlaceholderData || undefined}>
        {data.items.map((entry) => (
          <li key={entry.id}>
            <ActivityCard entry={entry} />
          </li>
        ))}
      </ul>
      <Pagination page={page} pages={data.pages} onPageChange={onPageChange} disabled={query.isPlaceholderData} />
    </>
  );
}

function ActivityCard({ entry }: { entry: FeedEntry }) {
  const { item, user } = entry;
  const title = "name" in item ? item.name : item.title;
  const artist = "artist" in item ? item.artist : null;

  return (
    <Card className={styles.card}>
      <div className={styles.author}>
        <span className={styles.avatar} aria-hidden>
          {user.username[0].toUpperCase()}
        </span>
        <div>
          <Link to={`/users/${user.username}/history`} className={styles.username}>
            @{user.username}
          </Link>
          <p className={styles.muted}>
            <time dateTime={entry.updated_at}>{formatDate(entry.updated_at)}</time>
          </p>
        </div>
      </div>
      <Stars value={entry.stars} label="Rating" size="sm" />
      <div>
        {entry.kind !== "song" && <p className={styles.kindPill}>{KIND_LABELS[entry.kind]}</p>}
        <h3>
          <Link to={`/${entry.kind}s/${item.mbid}`}>{title}</Link>
        </h3>
        {artist && (
          <p className={styles.muted}>
            <Link to={`/artists/${artist.mbid}`}>{artist.name}</Link>
          </p>
        )}
      </div>
      {entry.review && <p>{entry.review}</p>}
    </Card>
  );
}
