import { useState } from "react";
import { Link } from "react-router";
import type { Kind } from "../../api/types";
import { cx, ErrorNotice, formatDate, Notice, Pagination, Skeleton, Stars } from "../../ui";
import { useReviews } from "./api";
import styles from "./ReviewList.module.css";

interface ReviewListProps {
  kind: Kind;
  mbid: string;
}

// pages wrap this in their own Reviews section, the key resets paging for a new item
export function ReviewList({ kind, mbid }: ReviewListProps) {
  return <ReviewListBody key={`${kind}:${mbid}`} kind={kind} mbid={mbid} />;
}

function ReviewListBody({ kind, mbid }: ReviewListProps) {
  const [page, setPage] = useState(1);
  const reviews = useReviews(kind, mbid, page);
  const refreshing = reviews.isPlaceholderData;

  if (reviews.isPending) return <ReviewSkeleton />;
  if (reviews.isError) return <ErrorNotice error={reviews.error} onRetry={() => reviews.refetch()} />;
  if (reviews.data.items.length === 0) {
    return <Notice title="No reviews yet">Rate this {kind} and write the first one.</Notice>;
  }

  return (
    <>
      <ol className={cx(styles.list, refreshing && styles.refreshing)} aria-busy={refreshing || undefined}>
        {reviews.data.items.map((review) => (
          <li key={review.id} className={styles.review}>
            <div className={styles.meta}>
              <Link to={`/users/${review.user.username}/history`} className={styles.author}>
                {review.user.username}
              </Link>
              <Stars size="sm" value={review.stars} label={`${review.user.username}'s rating`} />
              <time dateTime={review.updated_at} className={styles.date}>
                {formatDate(review.updated_at)}
              </time>
            </div>
            <p className={styles.body}>{review.review}</p>
          </li>
        ))}
      </ol>
      <Pagination page={page} pages={reviews.data.pages} onPageChange={setPage} disabled={refreshing} />
    </>
  );
}

function ReviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading reviews" className={styles.list}>
      {[0, 1, 2].map((row) => (
        <div key={row} className={styles.review}>
          <Skeleton width="40%" height="var(--leading-sm)" />
          <Skeleton height="var(--space-12)" />
        </div>
      ))}
    </div>
  );
}
