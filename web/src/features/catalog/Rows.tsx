import { Link } from "react-router";
import type { Rated, SongSummary } from "../../api/types";
import { cx, formatDuration, Skeleton } from "../../ui";
import { AddToPlaylistButton } from "../playlists/AddToPlaylistButton";
import { RatingControl } from "../ratings/RatingControl";
import rows from "./rows.module.css";

export function SongTitle({ song }: { song: SongSummary }) {
  return (
    <span className={rows.titleLine}>
      <Link to={`/songs/${song.mbid}`} className={rows.title}>
        {song.title}
      </Link>
      {song.disambiguation && <span className={rows.note}>{song.disambiguation}</span>}
    </span>
  );
}

export function RowsSkeleton({ label }: { label: string }) {
  return (
    <ul className={rows.list} aria-busy="true" aria-label={label}>
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className={rows.row}>
          <div className={rows.main}>
            <Skeleton width="40%" />
            <Skeleton width="25%" height="var(--leading-sm)" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TrackRow({ song, index }: { song: Rated<SongSummary>; index: number }) {
  return (
    <li className={cx(rows.row, rows.track)}>
      <span className={rows.index}>{index}</span>
      <div className={rows.main}>
        <SongTitle song={song} />
      </div>
      <span className={rows.duration}>{song.length_ms !== null && formatDuration(song.length_ms)}</span>
      <div className={rows.rating}>
        <RatingControl compact kind="song" mbid={song.mbid} rating={song.rating} title={song.title} />
      </div>
      <div className={rows.add}>
        <AddToPlaylistButton mbid={song.mbid} />
      </div>
    </li>
  );
}
