import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { keepPreviousPage } from "../../api/keepPreviousPage";
import type { FeedEntry, FriendStatus, Friends, Page, PublicUser } from "../../api/types";
import { useMe } from "../auth/useMe";

export function useFriends() {
  const { user } = useMe();
  return useQuery({
    queryKey: ["friends"],
    queryFn: () => api.get<Friends>("/friends"),
    enabled: user !== null,
  });
}

export function friendStatus(friends: Friends | undefined, username: string): FriendStatus {
  if (!friends) return "none";
  if (friends.friends.some((friend) => friend.user.username === username)) return "friends";
  if (friends.outgoing.some((request) => request.user.username === username)) return "sent";
  if (friends.incoming.some((request) => request.user.username === username)) return "received";
  return "none";
}

function useInvalidateFriends() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["friends"] }),
      queryClient.invalidateQueries({ queryKey: ["feed"] }),
      queryClient.invalidateQueries({ queryKey: ["recent-reviews"] }),
    ]);
}

export function useSendRequest() {
  const invalidateFriends = useInvalidateFriends();
  return useMutation({
    mutationFn: (username: string) =>
      api.post<{ status: FriendStatus }>("/friends/requests", { username }),
    onSettled: invalidateFriends,
  });
}

export function useAcceptRequest() {
  const invalidateFriends = useInvalidateFriends();
  return useMutation({
    mutationFn: (username: string) =>
      api.post<{ status: FriendStatus }>(`/friends/requests/${encodeURIComponent(username)}/accept`),
    onSettled: invalidateFriends,
  });
}

// declines, cancels, and unfriends: the server removes whatever links the two users
export function useRemoveFriend() {
  const invalidateFriends = useInvalidateFriends();
  return useMutation({
    mutationFn: (username: string) => api.delete<void>(`/friends/${encodeURIComponent(username)}`),
    onSettled: invalidateFriends,
  });
}

export function useUserSearch(q: string) {
  return useQuery({
    queryKey: ["users", q],
    queryFn: () => api.get<{ items: PublicUser[] }>(`/users?q=${encodeURIComponent(q)}`),
    enabled: q !== "",
  });
}

export function useFeed(page: number) {
  const queryKey = ["feed", page];
  return useQuery({
    queryKey,
    queryFn: () => api.get<Page<FeedEntry>>(`/feed?page=${page}`),
    placeholderData: keepPreviousPage(queryKey),
  });
}

export function useRecentReviews(page: number, enabled: boolean) {
  const queryKey = ["recent-reviews", page];
  return useQuery({
    queryKey,
    queryFn: () => api.get<Page<FeedEntry>>(`/reviews/recent?page=${page}`),
    placeholderData: keepPreviousPage(queryKey),
    enabled,
  });
}
