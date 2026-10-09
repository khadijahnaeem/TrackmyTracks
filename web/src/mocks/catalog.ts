import type { AlbumSummary, ArtistSummary, Kind, SongSummary } from "../api/types";
import { SEED_ALBUMS, SEED_ARTISTS, SEED_SONGS } from "./seed";
import type { SeedAlbum, SeedArtist, SeedSong } from "./seed";

const byMbid = <T extends { mbid: string }>(rows: T[]): Map<string, T> => new Map(rows.map((row) => [row.mbid, row]));

const artists = byMbid(SEED_ARTISTS);
const albums = byMbid(SEED_ALBUMS);
const songs = byMbid(SEED_SONGS);

function lookup<T>(map: Map<string, T>, mbid: string): T {
  const row = map.get(mbid);
  if (!row) throw new Error(`unknown mbid ${mbid}`);
  return row;
}

export function artistSummary(mbid: string): ArtistSummary {
  const { name } = lookup<SeedArtist>(artists, mbid);
  return { mbid, name };
}

export function albumSummary(mbid: string): AlbumSummary {
  const { title, releaseYear, artistMbid } = lookup<SeedAlbum>(albums, mbid);
  return { mbid, title, release_year: releaseYear, artist: artistSummary(artistMbid) };
}

export function songSummary(mbid: string): SongSummary {
  const { title, disambiguation, lengthMs, artistMbid } = lookup<SeedSong>(songs, mbid);
  return { mbid, title, disambiguation, length_ms: lengthMs, artist: artistSummary(artistMbid) };
}

export const SUMMARIES: Record<Kind, (mbid: string) => ArtistSummary | AlbumSummary | SongSummary> = {
  artist: artistSummary,
  album: albumSummary,
  song: songSummary,
};

const TABLES: Record<Kind, Map<string, unknown>> = { artist: artists, album: albums, song: songs };

export const NOT_IN_CATALOG = "Not found in the music catalog";

export const hasEntity = (kind: Kind, mbid: string): boolean => TABLES[kind].has(mbid);

export const albumTracks = (albumMbid: string): string[] => lookup<SeedAlbum>(albums, albumMbid).tracks;

export const songsOn = albumTracks;

export const artistAlbums = (artistMbid: string): string[] =>
  SEED_ALBUMS.filter((album) => album.artistMbid === artistMbid)
    .sort((a, b) => b.releaseYear - a.releaseYear || a.title.localeCompare(b.title))
    .map((album) => album.mbid);

export const artistTopSongs = (artistMbid: string): string[] => lookup<SeedArtist>(artists, artistMbid).topSongs;

export const songsBy = (artistMbid: string): string[] =>
  SEED_SONGS.filter((song) => song.artistMbid === artistMbid).map((song) => song.mbid);

const LABELS: Record<Kind, () => { mbid: string; label: string }[]> = {
  artist: () => SEED_ARTISTS.map((row) => ({ mbid: row.mbid, label: row.name })),
  album: () => SEED_ALBUMS.map((row) => ({ mbid: row.mbid, label: row.title })),
  song: () => SEED_SONGS.map((row) => ({ mbid: row.mbid, label: row.title })),
};

export function searchCatalog(kind: Kind, query: string): string[] {
  const needle = query.toLowerCase();
  return LABELS[kind]()
    .filter((row) => row.label.toLowerCase().includes(needle))
    .map((row) => row.mbid);
}
