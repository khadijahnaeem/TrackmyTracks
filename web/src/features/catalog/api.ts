import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type {
  AlbumSummary,
  ArtistSummary,
  Kind,
  Page,
  Rated,
  SearchArtist,
  SearchSong,
  SongSummary,
} from "../../api/types";

export interface SearchItems {
  song: SearchSong;
  album: AlbumSummary;
  artist: SearchArtist;
}

export type Track = Rated<SongSummary> & { position: number };

export interface ArtistDetail {
  artist: Rated<ArtistSummary>;
  top_songs: Rated<SongSummary>[];
  albums: AlbumSummary[];
}

export interface AlbumDetail {
  album: Rated<AlbumSummary>;
  tracks: Track[];
}

export interface SongDetail {
  song: Rated<SongSummary>;
}

export function useSearch<K extends Kind>(type: K, q: string, page: number) {
  return useQuery({
    queryKey: ["search", type, q, page],
    queryFn: () => {
      const params = new URLSearchParams({ type, q, page: String(page) });
      return api.get<Page<SearchItems[K]>>(`/search?${params}`);
    },
    enabled: q !== "",
    // only a page change within the same type and query keeps the previous page
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === type && previousQuery.queryKey[2] === q ? previous : undefined,
  });
}

export function useArtist(mbid: string) {
  return useQuery({
    queryKey: ["artist", mbid],
    queryFn: () => api.get<ArtistDetail>(`/artists/${encodeURIComponent(mbid)}`),
  });
}

export function useAlbum(mbid: string) {
  return useQuery({
    queryKey: ["album", mbid],
    queryFn: () => api.get<AlbumDetail>(`/albums/${encodeURIComponent(mbid)}`),
  });
}

export function useSong(mbid: string) {
  return useQuery({
    queryKey: ["song", mbid],
    queryFn: () => api.get<SongDetail>(`/songs/${encodeURIComponent(mbid)}`),
  });
}
