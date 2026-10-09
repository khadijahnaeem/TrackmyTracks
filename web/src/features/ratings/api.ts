import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Kind, Page, RatingSummary, Review } from "../../api/types";

interface RatingResponse {
  mbid: string;
  rating: RatingSummary;
}

interface Target {
  kind: Kind;
  mbid: string;
}

interface SaveRatingInput extends Target {
  stars: number;
  review?: string;
}

const RATED_QUERY_KEYS = [["artist"], ["album"], ["song"], ["reviews"], ["history"]];

function useInvalidateRated() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(RATED_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useSaveRating() {
  const invalidateRated = useInvalidateRated();
  return useMutation({
    mutationFn: (input: SaveRatingInput) => api.put<RatingResponse>("/ratings", input),
    onSuccess: invalidateRated,
  });
}

export function useClearRating() {
  const invalidateRated = useInvalidateRated();
  return useMutation({
    mutationFn: ({ kind, mbid }: Target) => api.delete<RatingResponse>(`/ratings/${kind}/${mbid}`),
    onSuccess: invalidateRated,
  });
}

export function useReviews(kind: Kind, mbid: string, page: number) {
  return useQuery({
    queryKey: ["reviews", kind, mbid, page],
    queryFn: () => api.get<Page<Review>>(`/${kind}s/${mbid}/reviews?page=${page}`),
    placeholderData: keepPreviousData,
  });
}
