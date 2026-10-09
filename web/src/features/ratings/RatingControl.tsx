import { useState } from "react";
import { Link, useLocation } from "react-router";
import { errorMessage } from "../../api/client";
import type { CommunityRating, Kind, RatingSummary } from "../../api/types";
import { Button, buttonClassName, Card, formatAverage, pluralize, Stars } from "../../ui";
import { loginHref } from "../auth/redirects";
import { useMe } from "../auth/useMe";
import { useClearRating, useSaveRating } from "./api";
import styles from "./RatingControl.module.css";
import { ReviewComposer } from "./ReviewComposer";

interface RatingControlProps {
  kind: Kind;
  mbid: string;
  rating: RatingSummary;
  title?: string;
  compact?: boolean;
}

function communityText({ stars, count }: CommunityRating): string {
  return stars === null ? "No ratings yet" : `${formatAverage(stars)} from ${pluralize(count, "rating")}`;
}

export function RatingControl({ kind, mbid, rating, title, compact = false }: RatingControlProps) {
  const { user } = useMe();
  const location = useLocation();
  const save = useSaveRating();
  const clear = useClearRating();
  const [stars, setStars] = useState(rating.mine?.stars ?? null);
  const [syncedRating, setSyncedRating] = useState(rating);
  const [composing, setComposing] = useState(false);

  // fresh server data replaces the optimistic value
  if (syncedRating !== rating) {
    setSyncedRating(rating);
    setStars(rating.mine?.stars ?? null);
  }

  const mine = rating.mine;
  const derived = mine?.is_derived && stars === mine.stars ? mine : null;
  const error = save.error ?? clear.error;
  const errorText = error && (
    <p role="alert" className={styles.error}>
      {errorMessage(error)}
    </p>
  );

  const rate = (next: number) => {
    const previous = stars;
    setStars(next);
    save.mutate({ kind, mbid, stars: next }, { onError: () => setStars(previous) });
  };

  if (compact) {
    return (
      <div className={styles.compact}>
        {user && (
          <Stars
            size="sm"
            value={stars}
            label={`Your rating for ${title ?? `this ${kind}`}`}
            onChange={rate}
          />
        )}
        <span className={styles.muted}>{communityText(rating.community)}</span>
        {errorText}
      </div>
    );
  }

  return (
    <Card className={styles.panel}>
      <div className={styles.columns}>
        <div className={styles.block}>
          <p className={styles.label}>Your rating</p>
          {user ? (
            <div className={styles.inline}>
              <Stars value={stars} label="Your rating" onChange={rate} />
              {mine && !mine.is_derived && (
                <Button
                  variant="ghost"
                  loading={clear.isPending}
                  onClick={() => clear.mutate({ kind, mbid })}
                >
                  Clear
                </Button>
              )}
            </div>
          ) : (
            <Link to={loginHref(location.pathname + location.search)} className={buttonClassName("secondary")}>
              Log in to rate
            </Link>
          )}
          {derived && (
            <p className={styles.muted}>
              {formatAverage(derived.stars)}, average of your{" "}
              {pluralize(derived.song_count, "song rating")}. Rate to set your own.
            </p>
          )}
        </div>
        <div className={styles.block}>
          <p className={styles.label}>Community</p>
          <div className={styles.inline}>
            <Stars size="sm" value={rating.community.stars} label="Community rating" />
            <span className={styles.muted}>{communityText(rating.community)}</span>
          </div>
        </div>
      </div>
      {user &&
        (composing ? (
          <ReviewComposer
            kind={kind}
            mbid={mbid}
            stars={derived ? null : stars}
            review={mine?.review ?? null}
            onDone={() => setComposing(false)}
          />
        ) : (
          <Button onClick={() => setComposing(true)}>
            {mine?.review ? "Edit review" : "Write a review"}
          </Button>
        ))}
      {errorText}
    </Card>
  );
}
