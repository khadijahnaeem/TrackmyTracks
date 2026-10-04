import { useId } from "react";
import { Card, Stars } from "../../ui";
import styles from "./HomePage.module.css";
import { REVIEWS } from "./sampleData";
import { SectionHeading } from "./SectionHeading";

export function FreshReviews() {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} eyebrow="The community" title="Fresh Reviews" />
      <ul className={styles.reviews}>
        {REVIEWS.map(({ review, song, posted }) => (
          <li key={review.id}>
            <Card className={styles.card}>
              <div className={styles.author}>
                <span className={styles.avatar} aria-hidden>
                  {review.user.username[0].toUpperCase()}
                </span>
                <div>
                  <p className={styles.username}>@{review.user.username}</p>
                  <p className={styles.muted}>{posted}</p>
                </div>
              </div>
              <Stars value={review.stars} label="Rating" size="sm" />
              <div>
                <h3>{song.title}</h3>
                <p className={styles.muted}>{song.artist.name}</p>
              </div>
              <p>{review.review}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
