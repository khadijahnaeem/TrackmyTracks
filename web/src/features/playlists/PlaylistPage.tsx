import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { errorMessage } from "../../api/client";
import type { PlaylistDetail } from "../../api/types";
import {
  Button,
  buttonClassName,
  Card,
  ErrorNotice,
  formatDuration,
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
  const { user } = useMe();
  const [mode, setMode] = useState<Mode>("view");

  if (playlist.isPending) return <PlaylistSkeleton />;
  if (playlist.isError) {
    return <ErrorNotice error={playlist.error} onRetry={() => playlist.refetch()} />;
  }

  const detail = playlist.data;
  const owner = detail.owner.username;
  const isOwner = user?.username === owner;

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
              <Button onClick={() => setMode("edit")}>Edit details</Button>
              <Button variant="ghost" onClick={() => setMode("confirm-delete")}>
                Delete playlist
              </Button>
            </>
          )
        }
      />
      {detail.description && <p className={styles.description}>{detail.description}</p>}
      {isOwner && mode === "edit" && (
        <EditPlaylist detail={detail} onDone={() => setMode("view")} />
      )}
      {isOwner && mode === "confirm-delete" && (
        <DeleteConfirm detail={detail} onCancel={() => setMode("view")} />
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

function DeleteConfirm({ detail, onCancel }: { detail: PlaylistDetail; onCancel: () => void }) {
  const navigate = useNavigate();
  const remove = useDeletePlaylist(detail.id);
  const ownerPage = `/users/${detail.owner.username}/playlists`;

  return (
    <Card className={styles.panel}>
      <p className={styles.confirmTitle}>Delete playlist?</p>
      <p className={styles.muted}>This can't be undone. The songs stay in the catalog.</p>
      {remove.isError && (
        <p role="alert" className={styles.error}>
          {errorMessage(remove.error)}
        </p>
      )}
      <div className={styles.confirmActions}>
        <Button
          className={styles.danger}
          loading={remove.isPending}
          onClick={() => remove.mutate(undefined, { onSuccess: () => navigate(ownerPage) })}
        >
          Delete
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function SongList({ detail, isOwner }: { detail: PlaylistDetail; isOwner: boolean }) {
  const reorder = useReorderSongs(detail.id);
  const removeSong = useRemoveSong(detail.id);

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
  const move = (index: number, offset: -1 | 1) => {
    const next = [...mbids];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    reorder.mutate(next);
  };
  const failure = reorder.error ?? removeSong.error;

  return (
    <>
      {failure && <ErrorNotice error={failure} />}
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
                  variant="ghost"
                  aria-label={`Move ${song.title} up`}
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(index, -1)}
                >
                  Up
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Move ${song.title} down`}
                  disabled={index === mbids.length - 1 || reorder.isPending}
                  onClick={() => move(index, 1)}
                >
                  Down
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Remove ${song.title}`}
                  loading={removeSong.isPending && removeSong.variables === song.mbid}
                  onClick={() => removeSong.mutate(song.mbid)}
                >
                  Remove
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </>
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
