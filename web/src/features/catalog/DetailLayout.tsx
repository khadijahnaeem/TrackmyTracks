import { type ReactNode, useId } from "react";
import { isNotFound } from "../../api/client";
import { ErrorNotice, NotFoundState, PageHeader, Skeleton } from "../../ui";
import styles from "./DetailLayout.module.css";
import { RowsSkeleton } from "./Rows";

export function DetailLayout({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <aside className={styles.aside}>{aside}</aside>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={styles.skeleton}>
      <title>Loading | TrackmyTracks</title>
      <Skeleton width="6rem" height="var(--leading-xs)" />
      <Skeleton width="min(24rem, 80%)" height="var(--leading-3xl)" />
      <DetailLayout aside={<Skeleton height="calc(var(--space-16) * 3)" />}>
        <RowsSkeleton label="Loading tracks" />
      </DetailLayout>
    </div>
  );
}

export function DetailError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  if (isNotFound(error)) {
    return (
      <NotFoundState
        title="Not in the music catalog"
        noticeTitle="This entry is gone"
        message="MusicBrainz may have removed or merged this entry."
      />
    );
  }
  return (
    <>
      <PageHeader title="Something went wrong" />
      <ErrorNotice error={error} title="Could not load this entry" onRetry={onRetry} />
    </>
  );
}
