export type Kind = "song" | "album" | "artist";

export interface ArtistSummary {
  mbid: string;
  name: string;
}

export interface AlbumSummary {
  mbid: string;
  title: string;
  release_year: number | null;
  artist: ArtistSummary;
}

export interface SongSummary {
  mbid: string;
  title: string;
  disambiguation: string | null;
  length_ms: number | null;
  artist: ArtistSummary;
}

export interface MyRating {
  stars: number;
  is_derived: boolean;
  song_count: number;
  review: string | null;
}

export interface CommunityRating {
  stars: number | null;
  count: number;
}

export interface RatingSummary {
  mine: MyRating | null;
  community: CommunityRating;
}

export type Rated<T> = T & { rating: RatingSummary };

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface PublicUser {
  username: string;
}

export interface Review {
  id: number;
  user: PublicUser;
  stars: number;
  review: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: number;
  kind: Kind;
  item: ArtistSummary | AlbumSummary | SongSummary;
  stars: number;
  review: string | null;
  updated_at: string;
}

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  owner: PublicUser;
  song_count: number;
  updated_at: string;
}

export interface PlaylistDetail extends Playlist {
  songs: SongSummary[];
}
