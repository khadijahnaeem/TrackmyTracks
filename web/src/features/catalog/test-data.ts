import type { AlbumSummary, ArtistSummary, Page, RatingSummary, SongSummary } from "../../api/types";
import type { AlbumDetail, ArtistDetail, SongDetail } from "./api";

export const RADIOHEAD = "a74b1b7f-71a5-4011-9441-d0b5e4122711";
export const OK_COMPUTER = "b1392450-e666-3926-a536-22c65f834433";
export const KARMA_POLICE = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";

export const unrated: RatingSummary = { mine: null, community: { stars: null, count: 0 } };
export const radiohead: ArtistSummary = { mbid: RADIOHEAD, name: "Radiohead" };

function song(title: string, mbid: string, lengthMs: number): SongSummary {
  return { mbid, title, disambiguation: null, length_ms: lengthMs, artist: radiohead };
}

export const karmaPolice = song("Karma Police", KARMA_POLICE, 262426);

export const okComputer: AlbumSummary = {
  mbid: OK_COMPUTER,
  title: "OK Computer",
  release_year: 1997,
  artist: radiohead,
};

export function pageOf<T>(items: T[], pages = 1): Page<T> {
  return { items, page: 1, pages, total: items.length };
}

export const artistDetail: ArtistDetail = {
  artist: { ...radiohead, rating: { mine: null, community: { stars: 4.2, count: 18 } } },
  top_songs: [{ ...karmaPolice, rating: unrated }],
  albums: [
    {
      mbid: "6e335887-60ba-38f0-95af-fae7774336bf",
      title: "In Rainbows",
      release_year: 2007,
      artist: radiohead,
    },
  ],
};

export const albumDetail: AlbumDetail = {
  album: { ...okComputer, rating: unrated },
  tracks: [
    { ...song("Airbag", "4a7fea2e-545b-4c63-bc9a-9943cc3a29d7", 284400), rating: unrated, position: 1 },
    {
      ...song("Paranoid Android", "9f9cf187-d6f9-437f-9d98-d59cdbd52757", 384000),
      rating: unrated,
      position: 2,
    },
  ],
};

export const songDetail: SongDetail = { song: { ...karmaPolice, rating: unrated } };
