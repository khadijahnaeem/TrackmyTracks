import { type FormEvent, useState } from "react";
import { errorMessage } from "../../api/client";
import { Button, TextArea, TextField } from "../../ui";
import type { PlaylistFields } from "./api";
import styles from "./PlaylistForm.module.css";

const EMPTY: PlaylistFields = { name: "", description: null, is_public: true };

interface PlaylistFormProps {
  initial?: PlaylistFields;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (fields: PlaylistFields) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function PlaylistForm({
  initial = EMPTY,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
  autoFocus,
}: PlaylistFormProps) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [isPublic, setIsPublic] = useState(initial.is_public);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ name, description: description || null, is_public: isPublic });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label="Name"
        autoFocus={autoFocus}
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
      />
      <TextArea
        label="Description"
        value={description}
        maxLength={500}
        onChange={(event) => setDescription(event.target.value)}
      />
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
        />
        Public, anyone can see this playlist
      </label>
      {error ? (
        <p role="alert" className={styles.error}>
          {errorMessage(error)}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button type="submit" variant="primary" loading={pending} disabled={!name.trim()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
