import { Link } from "react-router";
import { formatDuration, PageHeader } from "../../ui";
import { AddToPlaylistButton } from "../playlists/AddToPlaylistButton";
import { RatingControl } from "../ratings/RatingControl";
import { ReviewList } from "../ratings/ReviewList";
import { useSong } from "./api";
import { DetailError, DetailLayout, DetailSkeleton, Section } from "./DetailLayout";
import rows from "./rows.module.css";
import { useMbidParam } from "./useMbidParam";

export function SongPage() {
  const query = useSong(useMbidParam());

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) return <DetailError error={query.error} onRetry={() => query.refetch()} />;
  const { song } = query.data;

  return (
    <>
      <PageHeader
        eyebrow="Song"
        title={song.title}
        meta={
          <span className={rows.meta}>
            <Link to={`/artists/${song.artist.mbid}`}>{song.artist.name}</Link>
            {song.length_ms !== null && <span>{formatDuration(song.length_ms)}</span>}
            {song.disambiguation && <span>{song.disambiguation}</span>}
          </span>
        }
      />
      <DetailLayout
        aside={
          <>
            <RatingControl key={song.mbid} kind="song" mbid={song.mbid} rating={song.rating} />
            <AddToPlaylistButton mbid={song.mbid} title={song.title} />
          </>
        }
      >
        <Section title="Reviews">
          <ReviewList kind="song" mbid={song.mbid} />
        </Section>
      </DetailLayout>
    </>
  );
}
