import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { ApiError, errorMessage } from "../../api/client";
import { Button, buttonClassName, Skeleton, TextField } from "../../ui";
import { loginHref } from "../auth/redirects";
import { useMe } from "../auth/useMe";
import { useAddSong, useCreatePlaylist, useUserPlaylists } from "./api";
import styles from "./AddToPlaylistButton.module.css";

type AddStatus = "pending" | "added" | "exists" | "failed";

const STATUS_LABELS: Record<Exclude<AddStatus, "pending">, string> = {
  added: "Added",
  exists: "Already added",
  failed: "Try again",
};

export function AddToPlaylistButton({ mbid }: { mbid: string }) {
  const { user, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) {
    return (
      <Button variant="ghost" disabled>
        Add to playlist
      </Button>
    );
  }
  if (!user) {
    return (
      <Link to={loginHref(location.pathname + location.search)} className={buttonClassName("ghost")}>
        Log in to add
      </Link>
    );
  }
  return <PlaylistPicker username={user.username} mbid={mbid} />;
}

function PlaylistPicker({ username, mbid }: { username: string; mbid: string }) {
  const [open, setOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <Button
        ref={triggerRef}
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        Add to playlist
      </Button>
      {open && (
        <div id={panelId} role="dialog" aria-label="Add to playlist" className={styles.panel}>
          <PlaylistChoices username={username} mbid={mbid} onStatusChange={setStatusMessage} />
          <NewPlaylistForm
            mbid={mbid}
            onStatusChange={setStatusMessage}
            onNameChange={() => setStatusMessage(null)}
          />
          {statusMessage && <p role="status" className={styles.note}>{statusMessage}</p>}
        </div>
      )}
    </div>
  );
}

function PlaylistChoices({
  username,
  mbid,
  onStatusChange,
}: {
  username: string;
  mbid: string;
  onStatusChange: (message: string) => void;
}) {
  const playlists = useUserPlaylists(username);
  const addSong = useAddSong();
  const [statuses, setStatuses] = useState<Record<number, AddStatus>>({});

  if (playlists.isPending) {
    return (
      <div className={styles.list} aria-busy="true">
        <Skeleton height="var(--control-height)" />
        <Skeleton height="var(--control-height)" />
      </div>
    );
  }
  if (playlists.isError) return <p className={styles.note}>{errorMessage(playlists.error)}</p>;
  if (playlists.data.length === 0) {
    return <p className={styles.note}>No playlists yet, create one below.</p>;
  }

  const setStatus = (playlistId: number, status: AddStatus) =>
    setStatuses((current) => ({ ...current, [playlistId]: status }));

  // mutateAsync settles every call, mutate callbacks only fire for the latest one
  const add = (playlist: (typeof playlists.data)[0]) => {
    setStatus(playlist.id, "pending");
    addSong
      .mutateAsync({ playlistId: playlist.id, mbid })
      .then(() => {
        setStatus(playlist.id, "added");
        onStatusChange(`Added to ${playlist.name}`);
      })
      .catch((error: unknown) => {
        const exists = error instanceof ApiError && error.status === 409;
        if (exists) {
          setStatus(playlist.id, "exists");
          onStatusChange(`Already in ${playlist.name}`);
        } else {
          setStatus(playlist.id, "failed");
          onStatusChange(`Could not add to ${playlist.name}, try again`);
        }
      });
  };

  return (
    <ul className={styles.list}>
      {playlists.data.map((playlist) => {
        const status = statuses[playlist.id];
        return (
          <li key={playlist.id}>
            <Button
              variant="ghost"
              className={styles.choice}
              loading={status === "pending"}
              disabled={status === "added" || status === "exists"}
              onClick={() => add(playlist)}
              aria-label={status && status !== "pending" ? `${playlist.name} ${STATUS_LABELS[status]}` : playlist.name}
            >
              <span className={styles.name}>{playlist.name}</span>
              {status && status !== "pending" && <span className={styles.status}>{STATUS_LABELS[status]}</span>}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function NewPlaylistForm({
  mbid,
  onStatusChange,
  onNameChange,
}: {
  mbid: string;
  onStatusChange: (message: string) => void;
  onNameChange: () => void;
}) {
  const [name, setName] = useState("");
  const [createdPlaylistId, setCreatedPlaylistId] = useState<number | null>(null);
  const createPlaylist = useCreatePlaylist();
  const addSong = useAddSong();
  const error = createPlaylist.error ?? addSong.error;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      let playlistId = createdPlaylistId;
      let playlistName = name;
      if (playlistId === null) {
        const playlist = await createPlaylist.mutateAsync({ name, description: null, is_public: true });
        playlistId = playlist.id;
        playlistName = playlist.name;
        setCreatedPlaylistId(playlist.id);
      }
      await addSong.mutateAsync({ playlistId, mbid });
      onStatusChange(`Added to ${playlistName}`);
      setName("");
      setCreatedPlaylistId(null);
    } catch {
      // the failed mutation renders its own error below
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label="New playlist"
        value={name}
        maxLength={100}
        onChange={(event) => {
          setName(event.target.value);
          setCreatedPlaylistId(null);
          onNameChange();
        }}
        error={error ? errorMessage(error) : undefined}
      />
      <Button
        type="submit"
        variant="primary"
        loading={createPlaylist.isPending || addSong.isPending}
        disabled={!name.trim()}
      >
        Create and add
      </Button>
    </form>
  );
}
