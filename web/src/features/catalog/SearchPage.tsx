import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import type { AlbumSummary, Kind, SearchArtist, SearchSong } from "../../api/types";
import {
  Button,
  cx,
  ErrorNotice,
  formatCount,
  formatDuration,
  Notice,
  PageHeader,
  Pagination,
  pluralize,
  SegmentedControl,
  TextField,
} from "../../ui";
import { AddToPlaylistButton } from "../playlists/AddToPlaylistButton";
import { type SearchItems, useSearch } from "./api";
import { RowsSkeleton, SongTitle } from "./Rows";
import rows from "./rows.module.css";
import styles from "./SearchPage.module.css";

const TYPES: { value: Kind; label: string }[] = [
  { value: "song", label: "Songs" },
  { value: "album", label: "Albums" },
  { value: "artist", label: "Artists" },
];

function parseType(value: string | null): Kind {
  return TYPES.find((option) => option.value === value)?.value ?? "song";
}

function searchParams(q: string, type: Kind, page = 1): URLSearchParams {
  const params = new URLSearchParams({ type });
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return params;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  const type = parseType(params.get("type"));
  const pageValue = params.get("page");
  const page = pageValue && Number.isInteger(Number(pageValue)) && Number(pageValue) > 0 ? Number(pageValue) : 1;

  // shares its query with the result list through the query cache
  const search = useSearch(type, q, page);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusResults = useRef(false);

  // focus the results heading once a page change from the pagination control settles
  useEffect(() => {
    if (focusResults.current && !search.isPlaceholderData) {
      focusResults.current = false;
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [search.isPlaceholderData, search.data, search.isError]);

  const handlePageChange = (next: number) => {
    focusResults.current = true;
    setParams(searchParams(q, type, next));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    setParams(searchParams(value, type));
  };

  return (
    <>
      <PageHeader title="Search" />
      <form role="search" className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          {/* keyed by the url query so back and forward refill the input */}
          <TextField key={q} name="q" label="Search music" defaultValue={q} maxLength={200} />
        </div>
        <Button type="submit" variant="primary">
          Search
        </Button>
      </form>
      <div className={styles.types}>
        <SegmentedControl
          label="Result type"
          options={TYPES}
          value={type}
          onChange={(next) => setParams(searchParams(q, next))}
        />
      </div>
      <p role="status" className="visually-hidden">
        {settledStatus(search, q, page)}
      </p>
      {q ? (
        <>
          <h2 ref={headingRef} tabIndex={-1} className="visually-hidden">
            Results
          </h2>
          <Results type={type} q={q} page={page} onPageChange={handlePageChange} />
        </>
      ) : (
        <Notice title="Search millions of songs, albums, and artists">
          Results come from MusicBrainz, the open music encyclopedia. Open any result to rate it.
        </Notice>
      )}
    </>
  );
}

function settledStatus(search: ReturnType<typeof useSearch>, q: string, page: number): string {
  if (!search.data || search.isPlaceholderData) return "";
  const { total, pages } = search.data;
  if (total === 0) return `No results for "${q}"`;
  return `${pluralize(total, "result")} for "${q}"${pages > 1 ? `, page ${page} of ${pages}` : ""}`;
}

interface ResultsProps {
  type: Kind;
  q: string;
  page: number;
  onPageChange: (page: number) => void;
}

function Results({ type, ...rest }: ResultsProps) {
  switch (type) {
    case "song":
      return <ResultList type="song" {...rest} render={(song) => <SongResult song={song} />} />;
    case "album":
      return <ResultList type="album" {...rest} render={(album) => <AlbumResult album={album} />} />;
    case "artist":
      return <ResultList type="artist" {...rest} render={(artist) => <ArtistResult artist={artist} />} />;
  }
}

interface ResultListProps<K extends Kind> extends Omit<ResultsProps, "type"> {
  type: K;
  render: (item: SearchItems[K]) => ReactNode;
}

function ResultList<K extends Kind>({ type, q, page, onPageChange, render }: ResultListProps<K>) {
  const search = useSearch(type, q, page);
  const refreshing = search.isPlaceholderData;

  if (search.isPending) return <RowsSkeleton label="Loading results" />;
  if (search.isError) return <ErrorNotice error={search.error} onRetry={() => search.refetch()} />;
  if (search.data.items.length === 0 && !refreshing) {
    return page > 1 ? (
      <Notice title="Past the end">
        Page {page} has no results. <Link to={`/search?${searchParams(q, type)}`}>Back to page 1</Link>
      </Notice>
    ) : (
      <Notice title={`No results for "${q}"`}>Check the spelling, or try another result type.</Notice>
    );
  }
  return (
    <>
      <ul className={cx(rows.list, refreshing && styles.refreshing)} aria-busy={refreshing || undefined}>
        {search.data.items.map((item) => (
          <li key={item.mbid} className={rows.row}>
            {render(item)}
          </li>
        ))}
      </ul>
      <Pagination page={page} pages={search.data.pages} onPageChange={onPageChange} disabled={refreshing} />
    </>
  );
}

function SongResult({ song }: { song: SearchSong }) {
  return (
    <>
      <div className={rows.main}>
        <SongTitle song={song} />
        <span className={rows.meta}>
          <Link to={`/artists/${song.artist.mbid}`}>{song.artist.name}</Link>
          {song.listens > 0 && <span>{formatCount(song.listens, "listen")}</span>}
        </span>
      </div>
      {song.length_ms !== null && <span className={rows.duration}>{formatDuration(song.length_ms)}</span>}
      <AddToPlaylistButton mbid={song.mbid} title={song.title} />
    </>
  );
}

function AlbumResult({ album }: { album: AlbumSummary }) {
  return (
    <div className={rows.main}>
      <Link to={`/albums/${album.mbid}`} className={rows.title}>
        {album.title}
      </Link>
      <span className={rows.meta}>
        <Link to={`/artists/${album.artist.mbid}`}>{album.artist.name}</Link>
        {album.release_year !== null && <span>{album.release_year}</span>}
      </span>
    </div>
  );
}

function ArtistResult({ artist }: { artist: SearchArtist }) {
  return (
    <div className={rows.main}>
      <Link to={`/artists/${artist.mbid}`} className={rows.title}>
        {artist.name}
      </Link>
      {artist.listens > 0 && <span className={rows.meta}>{formatCount(artist.listens, "listen")}</span>}
    </div>
  );
}
