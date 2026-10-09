import { useEffect, useId, useRef, useState } from "react";
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
  const { user, isLoading } = useMe();
  const location = useLocation();
  const target = { kind, mbid };
  const save = useSaveRating(target);
  const clear = useClearRating(target);
  const [view, setView] = useState(rating);
  const [stars, setStars] = useState(rating.mine?.stars ?? null);
  const [syncedRating, setSyncedRating] = useState(rating);
  const [composing, setComposing] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const wasComposing = useRef(false);
  const explanationId = useId();

  const show = (next: RatingSummary) => {
    setView(next);
    setStars(next.mine?.stars ?? null);
  };

  // fresh server data replaces the optimistic value, but never mid save
  if (syncedRating !== rating && !save.isPending && !clear.isPending) {
    setSyncedRating(rating);
    show(rating);
  }

  // closing the composer hands focus back to the button that opened it
  useEffect(() => {
    if (wasComposing.current && !composing) opener.current?.focus();
    wasComposing.current = composing;
  }, [composing]);

  const { mine, community } = view;
  const derived = mine?.is_derived && stars === mine.stars ? mine : null;
  const error = save.error ?? clear.error;
  const errorText = error && (
    <p role="alert" className={styles.error}>
      {errorMessage(error)}
    </p>
  );

  const rate = (next: number) => {
    const previous = stars;
    clear.reset();
    setStars(next);
    save.mutate(
      { stars: next },
      { onSuccess: (response) => show(response.rating), onError: () => setStars(previous) },
    );
  };

  const clearRating = () => {
    save.reset();
    clear.mutate(undefined, { onSuccess: (response) => show(response.rating) });
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
        <span className={styles.muted}>{communityText(community)}</span>
        {errorText}
      </div>
    );
  }

  return (
    <Card className={styles.panel}>
      <div className={styles.columns}>
        <div className={styles.block}>
          <p className={styles.label}>Your rating</p>
          {user && (
            <div className={styles.inline}>
              <Stars
                value={stars}
                label="Your rating"
                onChange={rate}
                describedBy={derived ? explanationId : undefined}
              />
              {mine && !mine.is_derived && (
                <Button
                  variant="ghost"
                  loading={clear.isPending}
                  onClick={clearRating}
                >
                  {mine.review ? "Clear rating and review" : "Clear rating"}
                </Button>
              )}
            </div>
          )}
          {!user && !isLoading && (
            <Link to={loginHref(location.pathname + location.search)} className={buttonClassName("secondary")}>
              Log in to rate
            </Link>
          )}
          {derived && (
            <p id={explanationId} className={styles.muted}>
              {formatAverage(derived.stars)}, average of your{" "}
              {pluralize(derived.song_count, "song rating")}. Rate to set your own.
            </p>
          )}
        </div>
        <div className={styles.block}>
          <p className={styles.label}>Community</p>
          <div className={styles.inline}>
            <Stars size="sm" value={community.stars} label="Community rating" />
            <span className={styles.muted}>{communityText(community)}</span>
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
            onSaved={(next) => {
              show(next);
              setComposing(false);
            }}
            onCancel={() => setComposing(false)}
          />
        ) : (
          <Button ref={opener} onClick={() => setComposing(true)}>
            {mine?.review ? "Edit review" : "Write a review"}
          </Button>
        ))}
      {errorText}
    </Card>
  );
}
