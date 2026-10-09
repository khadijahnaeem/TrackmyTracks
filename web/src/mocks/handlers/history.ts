import { http, type HttpHandler } from "msw";
import type { HistoryEntry, Kind } from "../../api/types";
import { SUMMARIES } from "../catalog";
import { invalid, notFound, pageArg, paginate, route } from "../respond";
import type { MockRating } from "../store";
import { findUserByName, state } from "../store";

const ENTRIES_PER_PAGE = 20;

function parseKind(value: string | null): Kind | null {
  if (value === null) return null;
  if (!Object.hasOwn(SUMMARIES, value)) throw invalid("Kind must be song, album, or artist");
  return value as Kind;
}

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
      const kind = parseKind(url.searchParams.get("kind"));
      const page = pageArg(url);

      // explicit rows only, derived album and artist ratings are never stored
      const entries = state()
        .ratings.filter((rating) => rating.userId === user.id && (kind === null || rating.kind === kind))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
      return paginate(entries.map(entryPayload), page, ENTRIES_PER_PAGE);
    }),
  ),
];
