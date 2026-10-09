import { Link } from "react-router";
import { Notice, PageHeader } from "../../ui";
import { RatingControl } from "../ratings/RatingControl";
import { ReviewList } from "../ratings/ReviewList";
import { useAlbum } from "./api";
import { DetailError, DetailLayout, DetailSkeleton, Section } from "./DetailLayout";
import { TrackList, TrackRow } from "./Rows";
import rows from "./rows.module.css";
import { useMbidParam } from "./useMbidParam";

export function AlbumPage() {
  const query = useAlbum(useMbidParam());

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) return <DetailError error={query.error} onRetry={() => query.refetch()} />;
  const { album, tracks } = query.data;

  return (
    <>
      <PageHeader
        eyebrow="Album"
        title={album.title}
        meta={
          <span className={rows.meta}>
            <Link to={`/artists/${album.artist.mbid}`}>{album.artist.name}</Link>
            {album.release_year !== null && <span>{album.release_year}</span>}
          </span>
        }
      />
      <DetailLayout aside={<RatingControl key={album.mbid} kind="album" mbid={album.mbid} rating={album.rating} />}>
        <Section title="Tracklist">
          {tracks.length === 0 ? (
            <Notice title="No tracklist yet">MusicBrainz has not listed the songs on this album.</Notice>
          ) : (
            <TrackList>
              {tracks.map((track) => (
                <TrackRow key={track.position} song={track} index={track.position} />
              ))}
            </TrackList>
          )}
        </Section>
        <Section title="Reviews">
          <ReviewList kind="album" mbid={album.mbid} />
        </Section>
      </DetailLayout>
    </>
  );
}
