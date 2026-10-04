import { useId } from "react";
import { Card, formatAverage, Stars } from "../../ui";
import styles from "./HomePage.module.css";
import { TRENDING } from "./sampleData";
import { SectionHeading } from "./SectionHeading";

export function TrendingTracks() {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} eyebrow="What's playing" title="Trending Tracks" />
      <ol className={styles.trending}>
        {TRENDING.map(({ song, community }, index) => (
          <li key={song.mbid}>
            <Card className={styles.card}>
              <span className={styles.cover} aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{song.title}</h3>
                <p className={styles.muted}>{song.artist.name}</p>
              </div>
              <div className={styles.rating}>
                <Stars value={community.stars} label="Community rating" size="sm" />
                <span>{community.stars === null ? "Not rated" : formatAverage(community.stars)}</span>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
