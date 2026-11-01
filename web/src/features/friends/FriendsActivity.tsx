import { useId, useState } from "react";
import { Link } from "react-router";
import type { FeedEntry } from "../../api/types";
import { buttonClassName, Card, ErrorNotice, formatDate, Notice, Pagination, Skeleton, Stars } from "../../ui";
import styles from "../home/HomePage.module.css";
import { SectionHeading } from "../home/SectionHeading";
import { useFeed } from "./api";

const KIND_LABELS = { album: "Album", artist: "Artist" } as const;

export function FriendsActivity() {
  const headingId = useId();
  const [page, setPage] = useState(1);
  const feed = useFeed(page);
  const { data } = feed;

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} eyebrow="Your friends" title="Friends' Activity" />
      {feed.isError ? (
        <ErrorNotice error={feed.error} title="Could not load friends' activity" onRetry={() => feed.refetch()} />
      ) : !data ? (
        <Skeleton height="var(--space-16)" />
      ) : data.items.length === 0 ? (
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
        <>
          <ul className={styles.reviews} aria-busy={feed.isPlaceholderData || undefined}>
            {data.items.map((entry) => (
              <li key={entry.id}>
                <ActivityCard entry={entry} />
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={data.pages} onPageChange={setPage} disabled={feed.isPlaceholderData} />
        </>
      )}
    </section>
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
