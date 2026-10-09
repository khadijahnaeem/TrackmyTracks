import { type RefObject, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { errorMessage, isNotFound } from "../../api/client";
import type { PlaylistDetail } from "../../api/types";
import {
  Button,
  buttonClassName,
  Card,
  ErrorNotice,
  formatDuration,
  NotFoundState,
  Notice,
  PageHeader,
  pluralize,
  Skeleton,
} from "../../ui";
import { useMe } from "../auth/useMe";
import { useDeletePlaylist, usePlaylist, useRemoveSong, useReorderSongs, useUpdatePlaylist } from "./api";
import { PlaylistForm } from "./PlaylistForm";
import styles from "./PlaylistPage.module.css";

type Mode = "view" | "edit" | "confirm-delete";

export function PlaylistPage() {
  const id = Number(useParams().id);
  const playlist = usePlaylist(id);
  const remove = useDeletePlaylist(id);
  const { user, isLoading: sessionLoading } = useMe();
  const [mode, setMode] = useState<Mode>("view");
  const editRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);

  if (playlist.isPending || sessionLoading) return <PlaylistSkeleton />;
  if (isNotFound(playlist.error)) return <NotFoundState />;
  if (playlist.isError) {
    return <ErrorNotice error={playlist.error} onRetry={() => playlist.refetch()} />;
  }

  const detail = playlist.data;
  const owner = detail.owner.username;
  const isOwner = user?.username === owner;

  // panels hand focus back to the button that opened them
  const closePanel = (opener: RefObject<HTMLButtonElement | null>) => {
    setMode("view");
    opener.current?.focus();
  };

  return (
    <>
      <PageHeader
        eyebrow={detail.is_public ? "Playlist" : "Private playlist"}
        title={detail.name}
        meta={
          <>
            By <Link to={`/users/${owner}/playlists`}>{owner}</Link>,{" "}
            {pluralize(detail.song_count, "song")}
          </>
        }
        actions={
          isOwner && (
            <>
              <Button
                ref={editRef}
                aria-expanded={mode === "edit"}
                disabled={remove.isPending}
                onClick={() => setMode("edit")}
              >
                Edit details
              </Button>
              <Button
                ref={deleteRef}
                variant="ghost"
                aria-expanded={mode === "confirm-delete"}
                disabled={remove.isPending}
                onClick={() => setMode("confirm-delete")}
              >
                Delete playlist
              </Button>
            </>
          )
        }
      />
      {detail.description && <p className={styles.description}>{detail.description}</p>}
      {isOwner && mode === "edit" && (
        <EditPlaylist detail={detail} onDone={() => closePanel(editRef)} />
      )}
      {isOwner && mode === "confirm-delete" && (
        <DeleteConfirm detail={detail} remove={remove} onCancel={() => closePanel(deleteRef)} />
      )}
      <SongList detail={detail} isOwner={isOwner} />
    </>
  );
}

function EditPlaylist({ detail, onDone }: { detail: PlaylistDetail; onDone: () => void }) {
  const update = useUpdatePlaylist(detail.id);

  return (
    <Card className={styles.panel}>
      <PlaylistForm
        autoFocus
        initial={{ name: detail.name, description: detail.description, is_public: detail.is_public }}
        submitLabel="Save changes"
        pending={update.isPending}
        error={update.error}
        onSubmit={(fields) => update.mutate(fields, { onSuccess: onDone })}
        onCancel={onDone}
      />
    </Card>
  );
}

interface DeleteConfirmProps {
  detail: PlaylistDetail;
  remove: ReturnType<typeof useDeletePlaylist>;
  onCancel: () => void;
}

function DeleteConfirm({ detail, remove, onCancel }: DeleteConfirmProps) {
  const navigate = useNavigate();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ownerPage = `/users/${detail.owner.username}/playlists`;

  useEffect(() => titleRef.current?.focus(), []);

  return (
    <Card className={styles.panel}>
      <h2 ref={titleRef} tabIndex={-1} className={styles.confirmTitle}>
        Delete playlist?
      </h2>
      <p className={styles.muted}>This can't be undone. The songs stay in the catalog.</p>
      {remove.isError && (
        <p role="alert" className={styles.error}>
          {errorMessage(remove.error)}
        </p>
      )}
      <div className={styles.confirmActions}>
        <Button
          variant="danger"
          loading={remove.isPending}
          onClick={() => remove.mutate(undefined, { onSuccess: () => navigate(ownerPage) })}
        >
          Delete
        </Button>
        <Button variant="ghost" disabled={remove.isPending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function SongList({ detail, isOwner }: { detail: PlaylistDetail; isOwner: boolean }) {
  const reorder = useReorderSongs(detail.id);
  const removeSong = useRemoveSong(detail.id);
  const [announcement, setAnnouncement] = useState("");
  // move buttons are keyed by `${mbid}-${dir}` so focus can follow a moved row
  const moveButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const busy = reorder.isPending || removeSong.isPending;

  // a move reorders DOM nodes, so focus is restored once the new order has rendered
  useEffect(() => {
    if (pendingFocus.current === null) return;
    moveButtons.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [detail.songs]);

  if (detail.songs.length === 0) {
    return isOwner ? (
      <Notice
        title="No songs yet"
        action={
          <Link to="/search" className={buttonClassName("primary")}>
            Find songs
          </Link>
        }
      >
        Use Add to playlist on any song to build this list.
      </Notice>
    ) : (
      <Notice title="This playlist is empty" />
    );
  }

  const mbids = detail.songs.map((song) => song.mbid);
  const last = mbids.length - 1;

  const move = (index: number, offset: -1 | 1) => {
    if (busy) return;
    const target = index + offset;
    const next = [...mbids];
    [next[index], next[target]] = [next[target], next[index]];

    // at the list edge that direction is unavailable, so focus the sibling button
    const [same, other] = offset === -1 ? (["up", "down"] as const) : (["down", "up"] as const);
    const reachedEdge = offset === -1 ? target === 0 : target === last;
    pendingFocus.current = `${mbids[index]}-${reachedEdge ? other : same}`;

    removeSong.reset();
    reorder.mutate(next, {
      onSuccess: () =>
        setAnnouncement(`${detail.songs[index].title} moved to position ${target + 1}`),
      onError: () => {
        pendingFocus.current = null;
      },
    });
  };

  const remove = (mbid: string) => {
    if (busy) return;
    reorder.reset();
    removeSong.mutate(mbid);
  };

  const trackButton = (mbid: string, direction: "up" | "down") => (node: HTMLButtonElement) => {
    moveButtons.current.set(`${mbid}-${direction}`, node);
    return () => {
      moveButtons.current.delete(`${mbid}-${direction}`);
    };
  };

  return (
    <div className={styles.songSection}>
      <h2 className="visually-hidden">Songs</h2>
      {reorder.isError && <ErrorNotice title="Could not reorder" error={reorder.error} />}
      {removeSong.isError && <ErrorNotice title="Could not remove" error={removeSong.error} />}
      <ol aria-label="Songs" className={styles.songs}>
        {detail.songs.map((song, index) => (
          <li key={song.mbid} className={styles.song}>
            <span className={styles.position}>{index + 1}</span>
            <div className={styles.titles}>
              <Link to={`/songs/${song.mbid}`} className={styles.title}>
                {song.title}
              </Link>
              <Link to={`/artists/${song.artist.mbid}`} className={styles.artist}>
                {song.artist.name}
              </Link>
            </div>
            <span className={styles.duration}>
              {song.length_ms === null ? "" : formatDuration(song.length_ms)}
            </span>
            {isOwner && (
              <div className={styles.controls}>
                <Button
                  ref={trackButton(song.mbid, "up")}
                  variant="ghost"
                  aria-label={`Move ${song.title} up`}
                  aria-disabled={busy || undefined}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  Up
                </Button>
                <Button
                  ref={trackButton(song.mbid, "down")}
                  variant="ghost"
                  aria-label={`Move ${song.title} down`}
                  aria-disabled={busy || undefined}
                  disabled={index === last}
                  onClick={() => move(index, 1)}
                >
                  Down
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Remove ${song.title}`}
                  aria-disabled={busy || undefined}
                  loading={removeSong.isPending && removeSong.variables === song.mbid}
                  onClick={() => remove(song.mbid)}
                >
                  Remove
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <p role="status" className="visually-hidden">
        {announcement}
      </p>
    </div>
  );
}

function PlaylistSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <Skeleton width="40%" height="var(--leading-3xl)" />
      <Skeleton width="20%" height="var(--leading-sm)" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height="var(--space-12)" />
      ))}
    </div>
  );
}
