import type { CommunityRating, Review, SongSummary } from "../../api/types";

// static stand ins from the frontend prototype until the api serves trending and recent reviews

export interface TrendingTrack {
  song: SongSummary;
  community: CommunityRating;
}

export interface RecentReview {
  review: Review;
  song: SongSummary;
  posted: string;
}

function song(n: number, title: string, artist: string): SongSummary {
  return {
    mbid: `00000000-0000-4000-8000-00000000000${n}`,
    title,
    disambiguation: null,
    length_ms: null,
    artist: { mbid: `00000000-0000-4000-8000-00000000010${n}`, name: artist },
  };
}

const MIDNIGHT_DRIVE = song(1, "Midnight Drive", "Neon Avenue");
const AFTER_HOURS = song(2, "After Hours", "Static Dreams");
const ELECTRIC_BLUE = song(3, "Electric Blue", "Night Shift");
const REPLAY = song(4, "Replay", "Echo Room");

export const TRENDING: TrendingTrack[] = [
  { song: MIDNIGHT_DRIVE, community: { stars: 4.4, count: 0 } },
  { song: AFTER_HOURS, community: { stars: 4.8, count: 0 } },
  { song: ELECTRIC_BLUE, community: { stars: 4.2, count: 0 } },
  { song: REPLAY, community: { stars: 4.7, count: 0 } },
];

function review(id: number, username: string, stars: number, text: string): Review {
  return { id, user: { username }, stars, review: text, updated_at: "2026-10-03T00:00:00+00:00" };
}

export const REVIEWS: RecentReview[] = [
  {
    review: review(1, "khadijah", 5, "This is one of those songs you immediately want to replay the second it ends."),
    song: MIDNIGHT_DRIVE,
    posted: "just now",
  },
  {
    review: review(2, "sam", 4, "The production is insane. Easily one of my favorite tracks from the album."),
    song: ELECTRIC_BLUE,
    posted: "12 min ago",
  },
  {
    review: review(3, "eyan", 5, "Exactly what I want from a late-night playlist."),
    song: REPLAY,
    posted: "28 min ago",
  },
];
