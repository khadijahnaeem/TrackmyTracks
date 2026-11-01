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

// search results also say how often each one was played
export type SearchArtist = ArtistSummary & { listens: number };
export type SearchSong = SongSummary & { listens: number };

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

export type FriendStatus = "none" | "friends" | "sent" | "received";

export interface Friend {
  user: PublicUser;
  since: string;
}

export interface FriendRequest {
  user: PublicUser;
  sent_at: string;
}

export interface Friends {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export type FeedEntry = HistoryEntry & { user: PublicUser };
