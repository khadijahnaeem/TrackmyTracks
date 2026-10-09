import { type ReactNode, useId } from "react";
import { Link } from "react-router";
import { isNotFound } from "../../api/client";
import { buttonClassName, ErrorNotice, Notice, PageHeader, Skeleton } from "../../ui";
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
    <div aria-busy="true" aria-label="Loading" className={styles.skeleton}>
      <Skeleton width="6rem" height="var(--leading-xs)" />
      <Skeleton width="min(24rem, 80%)" height="var(--leading-3xl)" />
      <RowsSkeleton label="Loading tracks" />
    </div>
  );
}

export function DetailError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  if (isNotFound(error)) {
    return (
      <>
        <PageHeader title="Not in the music catalog" />
        <Notice
          title="Not in the music catalog"
          action={
            <Link to="/search" className={buttonClassName("primary")}>
              Search music
            </Link>
          }
        >
          MusicBrainz may have removed or merged this entry.
        </Notice>
      </>
    );
  }
  return <ErrorNotice error={error} onRetry={onRetry} />;
}
