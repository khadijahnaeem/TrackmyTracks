import type { UseQueryResult } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { isNotFound } from "../../api/client";
import type { Playlist } from "../../api/types";
import { Card, ErrorNotice, NotFoundState, Notice, PageHeader, pluralize, Skeleton } from "../../ui";
import { useMe } from "../auth/useMe";
import { useCreatePlaylist, useUserPlaylists } from "./api";
import { PlaylistForm } from "./PlaylistForm";
import styles from "./UserPlaylistsPage.module.css";

export function UserPlaylistsPage() {
  const { username = "" } = useParams();
  const playlists = useUserPlaylists(username);
  const { user, isLoading: sessionLoading } = useMe();
  const isOwner = user?.username === username;

  if (isNotFound(playlists.error)) return <NotFoundState />;

  return (
    <>
      <PageHeader eyebrow="Playlists" title={`${username}'s playlists`} />
      <div className={styles.page}>
        {isOwner && <CreatePlaylistCard />}
        {sessionLoading ? (
          <GridSkeleton />
        ) : (
          <PlaylistGrid playlists={playlists} username={username} isOwner={isOwner} />
        )}
      </div>
    </>
  );
}

function CreatePlaylistCard() {
  const navigate = useNavigate();
  const createPlaylist = useCreatePlaylist();

  return (
    <Card className={styles.create}>
      <h2 className={styles.cardTitle}>New playlist</h2>
      <PlaylistForm
        submitLabel="Create playlist"
        pending={createPlaylist.isPending}
        error={createPlaylist.error}
        onSubmit={(fields) =>
          createPlaylist.mutate(fields, {
            onSuccess: (playlist) => navigate(`/playlists/${playlist.id}`),
          })
        }
      />
    </Card>
  );
}

function GridSkeleton() {
  return (
    <div className={styles.grid} aria-busy="true">
      {[0, 1, 2].map((i) => (
        <Card key={i} className={styles.card}>
          <Skeleton width="60%" height="var(--leading-lg)" />
          <Skeleton width="30%" height="var(--leading-sm)" />
        </Card>
      ))}
    </div>
  );
}

interface PlaylistGridProps {
  playlists: UseQueryResult<Playlist[]>;
  username: string;
  isOwner: boolean;
}

function PlaylistGrid({ playlists, username, isOwner }: PlaylistGridProps) {
  if (playlists.isPending) return <GridSkeleton />;
  if (playlists.isError) {
    return <ErrorNotice error={playlists.error} onRetry={() => playlists.refetch()} />;
  }
  if (playlists.data.length === 0) {
    return isOwner ? (
      <Notice title="No playlists yet">
        Name your first playlist above, then add songs from any song, album, or artist page.
      </Notice>
    ) : (
      <Notice title={`${username} has no public playlists`} />
    );
  }
  return (
    <ul className={styles.grid}>
      {playlists.data.map((playlist) => (
        <li key={playlist.id}>
          <PlaylistCard playlist={playlist} />
        </li>
      ))}
    </ul>
  );
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Card className={styles.card}>
      <h2 className={styles.cardTitle}>
        <Link to={`/playlists/${playlist.id}`}>{playlist.name}</Link>
      </h2>
      <p className={styles.meta}>
        {pluralize(playlist.song_count, "song")}
        {!playlist.is_public && <span className={styles.badge}>Private</span>}
      </p>
      {playlist.description && <p className={styles.description}>{playlist.description}</p>}
    </Card>
  );
}
