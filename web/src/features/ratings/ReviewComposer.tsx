import { type FormEvent, useState } from "react";
import { errorMessage } from "../../api/client";
import type { Kind } from "../../api/types";
import { Button, TextArea } from "../../ui";
import { useSaveRating } from "./api";
import styles from "./RatingControl.module.css";

const REVIEW_MAX_LENGTH = 2000;

interface ReviewComposerProps {
  kind: Kind;
  mbid: string;
  stars: number | null;
  review: string | null;
  onDone: () => void;
}

export function ReviewComposer({ kind, mbid, stars, review, onDone }: ReviewComposerProps) {
  const [text, setText] = useState(review ?? "");
  const save = useSaveRating();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (stars === null) return;
    save.mutate({ kind, mbid, stars, review: text }, { onSuccess: onDone });
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      <TextArea
        label="Your review"
        value={text}
        maxLength={REVIEW_MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
        error={save.error ? errorMessage(save.error) : undefined}
      />
      {stars === null && <p className={styles.muted}>Pick a star rating first</p>}
      <div className={styles.inline}>
        <Button type="submit" variant="primary" loading={save.isPending} disabled={stars === null}>
          Save review
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
