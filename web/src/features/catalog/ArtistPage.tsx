import { Link } from "react-router";
import { Card, Notice, PageHeader } from "../../ui";
import { RatingControl } from "../ratings/RatingControl";
import { ReviewList } from "../ratings/ReviewList";
import { useArtist } from "./api";
import { DetailError, DetailLayout, DetailSkeleton, Section } from "./DetailLayout";
import styles from "./DetailLayout.module.css";
import { TrackRow } from "./Rows";
import rows from "./rows.module.css";
import { useMbidParam } from "./useMbidParam";

export function ArtistPage() {
  const query = useArtist(useMbidParam());

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) return <DetailError error={query.error} onRetry={() => query.refetch()} />;
  const { artist, top_songs: topSongs, albums } = query.data;

  return (
    <>
      <PageHeader eyebrow="Artist" title={artist.name} />
      <DetailLayout aside={<RatingControl kind="artist" mbid={artist.mbid} rating={artist.rating} />}>
        <Section title="Popular songs">
          {topSongs.length === 0 ? (
            <Notice title="No listening data yet">
              ListenBrainz has no popularity numbers for this artist.
            </Notice>
          ) : (
            <ol className={rows.list}>
              {topSongs.map((song, i) => (
                <TrackRow key={song.mbid} song={song} index={i + 1} />
              ))}
            </ol>
          )}
        </Section>
        <Section title="Albums">
          {albums.length === 0 ? (
            <Notice title="No studio albums listed" />
          ) : (
            <ul className={styles.albumGrid}>
              {albums.map((album) => (
                <li key={album.mbid}>
                  <Card>
                    <Link to={`/albums/${album.mbid}`} className={styles.albumTitle}>
                      {album.title}
                    </Link>
                    {album.release_year !== null && <p className={styles.albumYear}>{album.release_year}</p>}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Reviews">
          <ReviewList kind="artist" mbid={artist.mbid} />
        </Section>
      </DetailLayout>
    </>
  );
}
