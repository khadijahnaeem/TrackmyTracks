import { type FormEvent, useId, useState } from "react";
import { errorMessage } from "../../api/client";
import type { Kind, RatingSummary } from "../../api/types";
import { Button, TextArea } from "../../ui";
import { useSaveRating } from "./api";
import styles from "./RatingControl.module.css";

const REVIEW_MAX_LENGTH = 2000;

interface ReviewComposerProps {
  kind: Kind;
  mbid: string;
  stars: number | null;
  review: string | null;
  onSaved: (rating: RatingSummary) => void;
  onCancel: () => void;
}

export function ReviewComposer({ kind, mbid, stars, review, onSaved, onCancel }: ReviewComposerProps) {
  const [text, setText] = useState(review ?? "");
  const save = useSaveRating({ kind, mbid });
  const hintId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (stars === null) return;
    save.mutate({ stars, review: text }, { onSuccess: (response) => onSaved(response.rating) });
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      <TextArea
        label="Your review"
        autoFocus
        value={text}
        maxLength={REVIEW_MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
        error={save.error ? errorMessage(save.error) : undefined}
      />
      {stars === null && <p id={hintId} className={styles.muted}>Pick a star rating first</p>}
      <div className={styles.inline}>
        <Button
          type="submit"
          variant="primary"
          loading={save.isPending}
          disabled={stars === null}
          aria-describedby={stars === null ? hintId : undefined}
        >
          Save review
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
