import { http, type HttpHandler } from "msw";
import type { Kind, Review } from "../../api/types";
import { hasEntity, NOT_IN_CATALOG, normalizeMbid, parseKind, parseMbid } from "../catalog";
import { invalid, jsonBody, notFound, optionalText, pageArg, paginate, route } from "../respond";
import type { MockRating } from "../store";
import { newestFirst, nextId, now, publicUser, ratingSummary, requireUser, save, state } from "../store";

const REVIEW_MAX_LENGTH = 2000;
const REVIEWS_PER_PAGE = 20;
const COLLECTIONS: Record<string, Kind> = { songs: "song", albums: "album", artists: "artist" };

// stars on the wire become a score of 1 to 10
function parseScore(value: unknown): number {
  const valid = typeof value === "number" && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
  if (!valid) throw invalid("Stars must be 0.5 to 5 in half star steps");
  return value * 2;
}

const missingMessage = (kind: Kind): string => `${kind.charAt(0).toUpperCase()}${kind.slice(1)} not found`;

type ReviewedRating = MockRating & { review: string };

const isReviewed = (rating: MockRating): rating is ReviewedRating => rating.review !== null;

const reviewPayload = (rating: ReviewedRating): Review => ({
  id: rating.id,
  user: publicUser(rating.userId),
  stars: rating.score / 2,
  review: rating.review,
  updated_at: rating.updatedAt,
});

const reviewRoutes = Object.entries(COLLECTIONS).map(([collection, kind]) =>
  http.get(
    `/api/${collection}/:mbid/reviews`,
    route(({ params, request }) => {
      const page = pageArg(new URL(request.url));
      const mbid = normalizeMbid(params.mbid);
      const reviews = state()
        .ratings.filter((rating) => rating.kind === kind && rating.mbid === mbid)
        .filter(isReviewed)
        .sort(newestFirst);
      return paginate(reviews.map(reviewPayload), page, REVIEWS_PER_PAGE);
    }),
  ),
);

export const ratingsHandlers: HttpHandler[] = [
  http.put(
    "/api/ratings",
    route(async ({ request }) => {
      const user = requireUser();
      const data = await jsonBody(request);
      const kind = parseKind(data.kind);
      const mbid = parseMbid(data.mbid, "Mbid must be a MusicBrainz ID");
      const score = parseScore(data.stars);
      const hasReview = "review" in data;
      const review = optionalText(data, "review", REVIEW_MAX_LENGTH);
      if (!hasEntity(kind, mbid)) throw notFound(NOT_IN_CATALOG);

      const saved = state().ratings.find((row) => row.userId === user.id && row.kind === kind && row.mbid === mbid);
      if (saved) {
        saved.score = score;
        if (hasReview) saved.review = review;
        saved.updatedAt = now();
      } else {
        state().ratings.push({ id: nextId(), userId: user.id, kind, mbid, score, review, updatedAt: now() });
      }
      save();
      return { mbid, rating: ratingSummary(kind, mbid) };
    }),
  ),

  http.delete(
    "/api/ratings/:kind/:mbid",
    route(({ params }) => {
      const user = requireUser();
      const kind = parseKind(params.kind);
      const mbid = normalizeMbid(params.mbid);
      if (mbid === null || !hasEntity(kind, mbid)) throw notFound(missingMessage(kind));

      const { ratings } = state();
      const index = ratings.findIndex((row) => row.userId === user.id && row.kind === kind && row.mbid === mbid);
      if (index >= 0) {
        ratings.splice(index, 1);
        save();
      }
      return { mbid, rating: ratingSummary(kind, mbid) };
    }),
  ),

  ...reviewRoutes,
];
