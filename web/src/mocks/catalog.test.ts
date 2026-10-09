import { describe, expect, test } from "vitest";
import {
  albumTracks,
  artistAlbums,
  artistTopSongs,
  hasEntity,
  searchCatalog,
  songSummary,
  songsBy,
  songsOn,
} from "./catalog";
import {
  AIRBAG,
  IN_RAINBOWS,
  OK_COMPUTER,
  PARANOID_ANDROID,
  RADIOHEAD,
  SEED_ALBUMS,
  SEED_ARTISTS,
  SEED_PLAYLISTS,
  SEED_RATINGS,
  SEED_SONGS,
  SEED_USERS,
} from "./seed";

const titles = (mbids: string[]) => mbids.map((mbid) => songSummary(mbid).title);

describe("catalog", () => {
  test("OK Computer lists its tracks in order", () => {
    expect(titles(albumTracks(OK_COMPUTER)).slice(0, 3)).toEqual([
      "Airbag",
      "Paranoid Android",
      "Subterranean Homesick Alien",
    ]);
  });

  test("summaries match the contract shapes", () => {
    expect(songSummary(AIRBAG)).toEqual({
      mbid: AIRBAG,
      title: "Airbag",
      disambiguation: null,
      length_ms: 284400,
      artist: { mbid: RADIOHEAD, name: "Radiohead" },
    });
  });

  test("artist albums are newest first", () => {
    expect(artistAlbums(RADIOHEAD)).toEqual([IN_RAINBOWS, OK_COMPUTER]);
  });

  test("search matches case insensitively", () => {
    expect(searchCatalog("song", "PARANOID")).toContain(PARANOID_ANDROID);
    expect(searchCatalog("artist", "radio")).toEqual([RADIOHEAD]);
  });

  test("songs by artist and on album come from the seed", () => {
    expect(songsBy(RADIOHEAD)).toHaveLength(22);
    expect(songsOn(OK_COMPUTER)).toEqual(albumTracks(OK_COMPUTER));
    expect(artistTopSongs(RADIOHEAD)).toHaveLength(5);
  });

  test("every reference in the seed resolves", () => {
    const refs = [
      ...SEED_ALBUMS.flatMap((album) => album.tracks.map((mbid) => ["song", mbid] as const)),
      ...SEED_ARTISTS.flatMap((artist) => artist.topSongs.map((mbid) => ["song", mbid] as const)),
      ...SEED_RATINGS.map((rating) => [rating.kind, rating.mbid] as const),
      ...SEED_PLAYLISTS.flatMap((playlist) => playlist.songs.map((mbid) => ["song", mbid] as const)),
    ];
    for (const [kind, mbid] of refs) expect(hasEntity(kind, mbid), `${kind} ${mbid}`).toBe(true);
    expect(SEED_SONGS.every((song) => hasEntity("artist", song.artistMbid))).toBe(true);
  });

  test("seed rows have unique ids and valid scores", () => {
    const ids = [...SEED_USERS, ...SEED_RATINGS, ...SEED_PLAYLISTS].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SEED_RATINGS.every((rating) => Number.isInteger(rating.score) && rating.score >= 1 && rating.score <= 10)).toBe(true);
  });

  test("every album has a review and an effective rating", () => {
    for (const album of SEED_ALBUMS) {
      const songs = new Set(album.tracks);
      const direct = SEED_RATINGS.filter((r) => r.kind === "album" && r.mbid === album.mbid);
      const derived = SEED_RATINGS.filter((r) => r.kind === "song" && songs.has(r.mbid));
      expect(direct.length + derived.length, album.title).toBeGreaterThan(0);
      expect(direct.some((r) => r.review), album.title).toBe(true);
    }
  });
});
