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

interface SaveRatingInput {
  stars: number;
  review?: string;
}

const RATED_QUERY_KEYS = [["artist"], ["album"], ["song"], ["reviews"], ["history"]];

// one mutation per target at a time, so the last click always wins
const ratingScope = ({ kind, mbid }: Target) => ({ id: `rating:${kind}:${mbid}` });

function useInvalidateRated() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(RATED_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useSaveRating(target: Target) {
  const invalidateRated = useInvalidateRated();
  return useMutation({
    mutationFn: (input: SaveRatingInput) => api.put<RatingResponse>("/ratings", { ...target, ...input }),
    scope: ratingScope(target),
    onSuccess: invalidateRated,
  });
}

export function useClearRating(target: Target) {
  const invalidateRated = useInvalidateRated();
  return useMutation({
    mutationFn: () => api.delete<RatingResponse>(`/ratings/${target.kind}/${target.mbid}`),
    scope: ratingScope(target),
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
