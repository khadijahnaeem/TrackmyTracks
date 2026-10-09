import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Playlist, PlaylistDetail } from "../../api/types";

export interface PlaylistFields {
  name: string;
  description: string | null;
  is_public: boolean;
}

export function useUserPlaylists(username: string) {
  return useQuery({
    queryKey: ["playlists", username],
    queryFn: () =>
      api.get<{ items: Playlist[] }>(`/users/${encodeURIComponent(username)}/playlists`),
    select: (data) => data.items,
  });
}

export function usePlaylist(id: number) {
  return useQuery({
    queryKey: ["playlist", id],
    queryFn: () => api.get<PlaylistDetail>(`/playlists/${id}`),
  });
}

// song changes return the whole playlist, so the cache is replaced instead of refetched
function useStoreDetail() {
  const queryClient = useQueryClient();
  return (detail: PlaylistDetail) => {
    queryClient.setQueryData(["playlist", detail.id], detail);
    return queryClient.invalidateQueries({ queryKey: ["playlists"] });
  };
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: PlaylistFields) => api.post<Playlist>("/playlists", fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useUpdatePlaylist(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: PlaylistFields) => api.patch<Playlist>(`/playlists/${id}`, fields),
    onSuccess: (playlist) => {
      queryClient.setQueryData<PlaylistDetail>(
        ["playlist", id],
        (detail) => detail && { ...detail, ...playlist },
      );
      return queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

export function useDeletePlaylist(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>(`/playlists/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["playlist", id] });
      return queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

export function useAddSong() {
  const storeDetail = useStoreDetail();
  return useMutation({
    mutationFn: ({ playlistId, mbid }: { playlistId: number; mbid: string }) =>
      api.post<PlaylistDetail>(`/playlists/${playlistId}/songs`, { mbid }),
    onSuccess: storeDetail,
  });
}

export function useRemoveSong(id: number) {
  const storeDetail = useStoreDetail();
  return useMutation({
    mutationFn: (mbid: string) => api.delete<PlaylistDetail>(`/playlists/${id}/songs/${mbid}`),
    onSuccess: storeDetail,
  });
}

export function useReorderSongs(id: number) {
  const storeDetail = useStoreDetail();
  return useMutation({
    mutationFn: (mbids: string[]) => api.put<PlaylistDetail>(`/playlists/${id}/songs`, { mbids }),
    onSuccess: storeDetail,
  });
}
