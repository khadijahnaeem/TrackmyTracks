import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { keepPreviousPage } from "../../api/keepPreviousPage";
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
  const queryKey = ["search", type, q, page];
  return useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ type, q, page: String(page) });
      return api.get<Page<SearchItems[K]>>(`/search?${params}`);
    },
    enabled: q !== "",
    placeholderData: keepPreviousPage(queryKey),
  });
}

function useDetail<T>(kind: Kind, mbid: string) {
  return useQuery({
    queryKey: [kind, mbid],
    queryFn: () => api.get<T>(`/${kind}s/${encodeURIComponent(mbid)}`),
  });
}

export const useArtist = (mbid: string) => useDetail<ArtistDetail>("artist", mbid);
export const useAlbum = (mbid: string) => useDetail<AlbumDetail>("album", mbid);
export const useSong = (mbid: string) => useDetail<SongDetail>("song", mbid);
