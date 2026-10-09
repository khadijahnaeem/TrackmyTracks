import { http, type HttpHandler } from "msw";
import type { HistoryEntry } from "../../api/types";
import { parseKind, SUMMARIES } from "../catalog";
import { notFound, pageArg, paginate, route } from "../respond";
import type { MockRating } from "../store";
import { findUserByName, newestFirst, state } from "../store";

const ENTRIES_PER_PAGE = 20;

const entryPayload = (rating: MockRating): HistoryEntry => ({
  id: rating.id,
  kind: rating.kind,
  item: SUMMARIES[rating.kind](rating.mbid),
  stars: rating.score / 2,
  review: rating.review,
  updated_at: rating.updatedAt,
});

export const historyHandlers: HttpHandler[] = [
  http.get(
    "/api/users/:username/history",
    route(({ params, request }) => {
      const user = findUserByName(String(params.username));
      if (!user) throw notFound("User not found");
      const url = new URL(request.url);
      const rawKind = url.searchParams.get("kind");
      const kind = rawKind === null ? null : parseKind(rawKind);
      const page = pageArg(url);

      // explicit rows only, derived album and artist ratings are never stored
      const entries = state()
        .ratings.filter((rating) => rating.userId === user.id && (kind === null || rating.kind === kind))
        .sort(newestFirst);
      return paginate(entries.map(entryPayload), page, ENTRIES_PER_PAGE);
    }),
  ),
];
