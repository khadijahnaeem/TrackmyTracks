import { http, type HttpHandler } from "msw";
import type { Kind, Review } from "../../api/types";
import { hasEntity } from "../catalog";
import { invalid, jsonBody, notFound, optionalText, pageArg, paginate, route } from "../respond";
import type { MockRating } from "../store";
import { nextId, now, publicUser, ratingSummary, requireUser, save, state } from "../store";

const REVIEW_MAX_LENGTH = 2000;
const REVIEWS_PER_PAGE = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLLECTIONS: Record<string, Kind> = { songs: "song", albums: "album", artists: "artist" };

const isKind = (value: unknown): value is Kind => Object.values(COLLECTIONS).some((kind) => kind === value);

function parseKind(value: unknown): Kind {
  if (!isKind(value)) throw invalid("Kind must be song, album, or artist");
  return value;
}

function parseMbid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw invalid("Mbid must be a MusicBrainz ID");
  return value.toLowerCase();
}

// stars on the wire become a score of 1 to 10
function parseScore(value: unknown): number {
  const valid = typeof value === "number" && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
  if (!valid) throw invalid("Stars must be 0.5 to 5 in half star steps");
  return value * 2;
}

const ensureKnown = (kind: Kind, mbid: string): void => {
  if (!hasEntity(kind, mbid)) throw notFound(`${kind.charAt(0).toUpperCase()}${kind.slice(1)} not found`);
};

const reviewPayload = (rating: MockRating): Review => ({
  id: rating.id,
  user: publicUser(rating.userId),
  stars: rating.score / 2,
  review: rating.review ?? "",
  updated_at: rating.updatedAt,
});

const reviewRoutes = Object.entries(COLLECTIONS).map(([collection, kind]) =>
  http.get(
    `/api/${collection}/:mbid/reviews`,
    route(({ params, request }) => {
      const page = pageArg(new URL(request.url));
      const reviews = state()
        .ratings.filter((rating) => rating.kind === kind && rating.mbid === params.mbid && rating.review !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
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
      const mbid = parseMbid(data.mbid);
      const score = parseScore(data.stars);
      const hasReview = "review" in data;
      const review = optionalText(data, "review", REVIEW_MAX_LENGTH);
      ensureKnown(kind, mbid);

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
      const mbid = String(params.mbid).toLowerCase();
      ensureKnown(kind, mbid);

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
