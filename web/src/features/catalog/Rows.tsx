import { Link } from "react-router";
import type { SongSummary } from "../../api/types";
import { Skeleton } from "../../ui";
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
