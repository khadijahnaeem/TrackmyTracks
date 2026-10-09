import type { Kind } from "../api/types";

// catalog recorded from MusicBrainz, album years come from the earliest official release
// recording mbids are the song mbids

export interface SeedArtist {
  mbid: string;
  name: string;
  topSongs: string[];
}

export interface SeedAlbum {
  mbid: string;
  title: string;
  releaseYear: number;
  artistMbid: string;
  tracks: string[];
}

export interface SeedSong {
  mbid: string;
  title: string;
  disambiguation: string | null;
  lengthMs: number;
  artistMbid: string;
}

export interface MockUser {
  id: number;
  email: string;
  username: string;
  password: string;
}

// score is 1 to 10, a rating targets one song, album, or artist by mbid
export interface MockRating {
  id: number;
  userId: number;
  kind: Kind;
  mbid: string;
  score: number;
  review: string | null;
  updatedAt: string;
}

// songs are song mbids in order
export interface MockPlaylist {
  id: number;
  ownerId: number;
  name: string;
  description: string | null;
  isPublic: boolean;
  songs: string[];
  updatedAt: string;
}

export const DEMO_LOGIN = { email: "demo@trackmytracks.dev", password: "listen-closely" };

export const RADIOHEAD = "a74b1b7f-71a5-4011-9441-d0b5e4122711";
export const PORTISHEAD = "8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11";
export const BJORK = "87c5dedd-371d-4a53-9f7f-80522fb7f3cb";
export const MASSIVE_ATTACK = "10adbe5e-a2c0-4bf3-8249-2b4cbf6e6ca8";

export const OK_COMPUTER = "b1392450-e666-3926-a536-22c65f834433";
export const IN_RAINBOWS = "6e335887-60ba-38f0-95af-fae7774336bf";
export const DUMMY = "48140466-cff6-3222-bd55-63c27e43190d";
export const HOMOGENIC = "810272e0-aef1-3d85-b2d3-e512e87fc38c";
export const MEZZANINE = "6f9f6899-c0d3-311d-ae87-a10ae6bc53a9";

export const AIRBAG = "4a7fea2e-545b-4c63-bc9a-9943cc3a29d7";
export const PARANOID_ANDROID = "9f9cf187-d6f9-437f-9d98-d59cdbd52757";
export const SUBTERRANEAN_HOMESICK_ALIEN = "bd82738d-163c-4b1a-bfaf-7acffe30e68a";
export const EXIT_MUSIC = "23c3c36b-9449-4484-9040-6ef2125999aa";
export const LET_DOWN = "47b02a82-c3bf-4647-b894-dd1c8f608e7f";
export const KARMA_POLICE = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
export const FITTER_HAPPIER = "5838f978-0822-4e28-874f-e1511324ec3a";
export const ELECTIONEERING = "ba0a796c-bd1f-4d4b-85a8-918f217a204a";
export const CLIMBING_UP_THE_WALLS = "c7225576-001e-423c-adc1-58f0985dcb27";
export const NO_SURPRISES = "980a426e-623e-4ea5-98c7-008d037a0508";
export const LUCKY = "79047824-f821-4b1a-9893-e0cea1c947dd";
export const THE_TOURIST = "610c0012-6eb4-42a0-b759-3a2532ce0f15";
export const FIFTEEN_STEP = "faea2aa0-80a9-41be-9b1e-3b994f4f76ac";
export const BODYSNATCHERS = "94a1d84a-66ce-4fc9-88a5-c46263c54d9a";
export const NUDE = "f3bea96c-5ebf-4d37-990d-14f1bc281459";
export const WEIRD_FISHES_ARPEGGI = "f74b48a6-5a60-4b5a-864d-3ecb7e983c31";
export const ALL_I_NEED = "72c6b4d3-71a8-4c70-bf50-da11c0149089";
export const FAUST_ARP = "ffac3cb1-a5e9-4f31-952d-45323f3640d5";
export const RECKONER = "d9b46ecb-5472-4dcd-8fa4-dd6723189e27";
export const HOUSE_OF_CARDS = "29a9d792-151b-4dd4-99ae-25bc853d8895";
export const JIGSAW_FALLING_INTO_PLACE = "31600df4-e6dd-48ca-9f6b-8804027d8d6e";
export const VIDEOTAPE = "8648fe94-bbdc-44a1-9de8-c4ced7913dc2";
export const MYSTERONS = "b5d7d380-f43a-4c1f-a5de-694150b093ac";
export const SOUR_TIMES = "1234a7ae-2af2-4291-aa84-bd0bafe291a1";
export const STRANGERS = "e97f805a-ab48-4c52-855e-07049142113d";
export const IT_COULD_BE_SWEET = "c837f888-d471-4b07-bcbc-1b9f7406ec1a";
export const WANDERING_STAR = "9170054a-8a9b-4f33-b31f-4ed58347154a";
export const ITS_A_FIRE = "46d6ebba-8d3f-4600-a2a3-9eab4713458d";
export const NUMB = "977c23ba-10e0-4c03-a882-5896e58717ae";
export const ROADS = "8a49dba0-253a-4535-b87f-78bb035336ce";
export const PEDESTAL = "c7baf0bc-77ed-454e-92a0-687f6b70d612";
export const BISCUIT = "5efc1689-a6e8-45d3-a481-774be58e8b59";
export const GLORY_BOX = "145f5c43-0ac2-4886-8b09-63d0e92ded5d";
export const HUNTER = "95be89c5-f55f-40a8-96bd-7a285c348096";
export const JOGA = "83534ada-9f60-4093-bbf3-ca182a03cf8b";
export const UNRAVEL = "20af32c5-38f3-4717-a65b-8dcb26ce53b8";
export const BACHELORETTE = "8ddbc4f1-f3db-47f1-b727-b4ceaf98cef8";
export const ALL_NEON_LIKE = "e7dacee3-36f2-4a40-a658-61fd2ce04d28";
export const FIVE_YEARS = "ca9bb619-50d9-45f5-a65c-bd0b53dcf848";
export const IMMATURE = "5125ec6f-b7cb-4573-a255-26a1227ae160";
export const ALARM_CALL = "32abc30c-3655-460d-b910-1086bf10e48b";
export const PLUTO = "d6febbc3-1495-45f5-a987-0f236d094086";
export const ALL_IS_FULL_OF_LOVE = "7f527f79-3303-4f30-add1-3b58b65181d9";
export const ANGEL = "8e74dd9d-e5a3-4acd-918a-c36a0f8cda84";
export const RISINGSON = "02011500-814c-461c-b3a6-f24fe68ee5a1";
export const TEARDROP = "f3bba4cd-8018-468b-902e-bc8f029593e5";
export const INERTIA_CREEPS = "cb704029-adf6-408f-b91b-6883df02540a";
export const EXCHANGE = "1bfc064e-fcd0-406b-98ca-1ec69f72fef6";
export const DISSOLVED_GIRL = "c3ace904-a6bd-4e70-b550-c88785610ef9";
export const MAN_NEXT_DOOR = "9b08eb49-1df7-4138-9bfa-2487c6fa0925";
export const BLACK_MILK = "048e135c-204d-4d77-8e6a-203920768e4f";
export const MEZZANINE_SONG = "c671a7e3-dd6e-4d38-a96d-f30bcafe7dd5";
export const GROUP_FOUR = "27c4755a-7299-49a6-8e46-227eb4ebf575";
export const EXCHANGE_REPRISE = "b6293447-05bf-4123-bfe5-099754348bbf";

export const SEED_ARTISTS: SeedArtist[] = [
  { mbid: RADIOHEAD, name: "Radiohead", topSongs: [PARANOID_ANDROID, KARMA_POLICE, NO_SURPRISES, EXIT_MUSIC, WEIRD_FISHES_ARPEGGI] },
  { mbid: PORTISHEAD, name: "Portishead", topSongs: [GLORY_BOX, SOUR_TIMES, ROADS, NUMB, MYSTERONS] },
  { mbid: BJORK, name: "Björk", topSongs: [ALL_IS_FULL_OF_LOVE, HUNTER, JOGA, BACHELORETTE, ALARM_CALL] },
  { mbid: MASSIVE_ATTACK, name: "Massive Attack", topSongs: [TEARDROP, ANGEL, RISINGSON, INERTIA_CREEPS, DISSOLVED_GIRL] },
];

export const SEED_ALBUMS: SeedAlbum[] = [
  {
    mbid: OK_COMPUTER,
    title: "OK Computer",
    releaseYear: 1997,
    artistMbid: RADIOHEAD,
    tracks: [AIRBAG, PARANOID_ANDROID, SUBTERRANEAN_HOMESICK_ALIEN, EXIT_MUSIC, LET_DOWN, KARMA_POLICE, FITTER_HAPPIER, ELECTIONEERING, CLIMBING_UP_THE_WALLS, NO_SURPRISES, LUCKY, THE_TOURIST],
  },
  {
    mbid: IN_RAINBOWS,
    title: "In Rainbows",
    releaseYear: 2007,
    artistMbid: RADIOHEAD,
    tracks: [FIFTEEN_STEP, BODYSNATCHERS, NUDE, WEIRD_FISHES_ARPEGGI, ALL_I_NEED, FAUST_ARP, RECKONER, HOUSE_OF_CARDS, JIGSAW_FALLING_INTO_PLACE, VIDEOTAPE],
  },
  {
    mbid: DUMMY,
    title: "Dummy",
    releaseYear: 1994,
    artistMbid: PORTISHEAD,
    tracks: [MYSTERONS, SOUR_TIMES, STRANGERS, IT_COULD_BE_SWEET, WANDERING_STAR, ITS_A_FIRE, NUMB, ROADS, PEDESTAL, BISCUIT, GLORY_BOX],
  },
  {
    mbid: HOMOGENIC,
    title: "Homogenic",
    releaseYear: 1997,
    artistMbid: BJORK,
    tracks: [HUNTER, JOGA, UNRAVEL, BACHELORETTE, ALL_NEON_LIKE, FIVE_YEARS, IMMATURE, ALARM_CALL, PLUTO, ALL_IS_FULL_OF_LOVE],
  },
  {
    mbid: MEZZANINE,
    title: "Mezzanine",
    releaseYear: 1998,
    artistMbid: MASSIVE_ATTACK,
    tracks: [ANGEL, RISINGSON, TEARDROP, INERTIA_CREEPS, EXCHANGE, DISSOLVED_GIRL, MAN_NEXT_DOOR, BLACK_MILK, MEZZANINE_SONG, GROUP_FOUR, EXCHANGE_REPRISE],
  },
];

export const SEED_SONGS: SeedSong[] = [
  { mbid: AIRBAG, title: "Airbag", disambiguation: null, lengthMs: 284400, artistMbid: RADIOHEAD },
  { mbid: PARANOID_ANDROID, title: "Paranoid Android", disambiguation: null, lengthMs: 384000, artistMbid: RADIOHEAD },
  { mbid: SUBTERRANEAN_HOMESICK_ALIEN, title: "Subterranean Homesick Alien", disambiguation: null, lengthMs: 267706, artistMbid: RADIOHEAD },
  { mbid: EXIT_MUSIC, title: "Exit Music (for a Film)", disambiguation: null, lengthMs: 264800, artistMbid: RADIOHEAD },
  { mbid: LET_DOWN, title: "Let Down", disambiguation: null, lengthMs: 299266, artistMbid: RADIOHEAD },
  { mbid: KARMA_POLICE, title: "Karma Police", disambiguation: null, lengthMs: 262426, artistMbid: RADIOHEAD },
  { mbid: FITTER_HAPPIER, title: "Fitter Happier", disambiguation: null, lengthMs: 117333, artistMbid: RADIOHEAD },
  { mbid: ELECTIONEERING, title: "Electioneering", disambiguation: null, lengthMs: 230640, artistMbid: RADIOHEAD },
  { mbid: CLIMBING_UP_THE_WALLS, title: "Climbing Up the Walls", disambiguation: null, lengthMs: 285200, artistMbid: RADIOHEAD },
  { mbid: NO_SURPRISES, title: "No Surprises", disambiguation: null, lengthMs: 228533, artistMbid: RADIOHEAD },
  { mbid: LUCKY, title: "Lucky", disambiguation: null, lengthMs: 259626, artistMbid: RADIOHEAD },
  { mbid: THE_TOURIST, title: "The Tourist", disambiguation: null, lengthMs: 324533, artistMbid: RADIOHEAD },
  { mbid: FIFTEEN_STEP, title: "15 Step", disambiguation: null, lengthMs: 238000, artistMbid: RADIOHEAD },
  { mbid: BODYSNATCHERS, title: "Bodysnatchers", disambiguation: null, lengthMs: 242293, artistMbid: RADIOHEAD },
  { mbid: NUDE, title: "Nude", disambiguation: null, lengthMs: 255386, artistMbid: RADIOHEAD },
  { mbid: WEIRD_FISHES_ARPEGGI, title: "Weird Fishes/Arpeggi", disambiguation: null, lengthMs: 318186, artistMbid: RADIOHEAD },
  { mbid: ALL_I_NEED, title: "All I Need", disambiguation: null, lengthMs: 228746, artistMbid: RADIOHEAD },
  { mbid: FAUST_ARP, title: "Faust Arp", disambiguation: null, lengthMs: 129680, artistMbid: RADIOHEAD },
  { mbid: RECKONER, title: "Reckoner", disambiguation: null, lengthMs: 290213, artistMbid: RADIOHEAD },
  { mbid: HOUSE_OF_CARDS, title: "House of Cards", disambiguation: null, lengthMs: 328293, artistMbid: RADIOHEAD },
  { mbid: JIGSAW_FALLING_INTO_PLACE, title: "Jigsaw Falling Into Place", disambiguation: null, lengthMs: 248893, artistMbid: RADIOHEAD },
  { mbid: VIDEOTAPE, title: "Videotape", disambiguation: null, lengthMs: 281800, artistMbid: RADIOHEAD },
  { mbid: MYSTERONS, title: "Mysterons", disambiguation: null, lengthMs: 306200, artistMbid: PORTISHEAD },
  { mbid: SOUR_TIMES, title: "Sour Times", disambiguation: null, lengthMs: 253760, artistMbid: PORTISHEAD },
  { mbid: STRANGERS, title: "Strangers", disambiguation: null, lengthMs: 238000, artistMbid: PORTISHEAD },
  { mbid: IT_COULD_BE_SWEET, title: "It Could Be Sweet", disambiguation: null, lengthMs: 259959, artistMbid: PORTISHEAD },
  { mbid: WANDERING_STAR, title: "Wandering Star", disambiguation: null, lengthMs: 293960, artistMbid: PORTISHEAD },
  { mbid: ITS_A_FIRE, title: "It’s a Fire", disambiguation: null, lengthMs: 228000, artistMbid: PORTISHEAD },
  { mbid: NUMB, title: "Numb", disambiguation: null, lengthMs: 237866, artistMbid: PORTISHEAD },
  { mbid: ROADS, title: "Roads", disambiguation: null, lengthMs: 305173, artistMbid: PORTISHEAD },
  { mbid: PEDESTAL, title: "Pedestal", disambiguation: null, lengthMs: 221000, artistMbid: PORTISHEAD },
  { mbid: BISCUIT, title: "Biscuit", disambiguation: null, lengthMs: 304026, artistMbid: PORTISHEAD },
  { mbid: GLORY_BOX, title: "Glory Box", disambiguation: null, lengthMs: 305573, artistMbid: PORTISHEAD },
  { mbid: HUNTER, title: "Hunter", disambiguation: null, lengthMs: 255266, artistMbid: BJORK },
  { mbid: JOGA, title: "Jóga", disambiguation: null, lengthMs: 305360, artistMbid: BJORK },
  { mbid: UNRAVEL, title: "Unravel", disambiguation: null, lengthMs: 201386, artistMbid: BJORK },
  { mbid: BACHELORETTE, title: "Bachelorette", disambiguation: null, lengthMs: 315000, artistMbid: BJORK },
  { mbid: ALL_NEON_LIKE, title: "All Neon Like", disambiguation: null, lengthMs: 353266, artistMbid: BJORK },
  { mbid: FIVE_YEARS, title: "5 Years", disambiguation: null, lengthMs: 269066, artistMbid: BJORK },
  { mbid: IMMATURE, title: "Immature", disambiguation: null, lengthMs: 186266, artistMbid: BJORK },
  { mbid: ALARM_CALL, title: "Alarm Call", disambiguation: null, lengthMs: 259773, artistMbid: BJORK },
  { mbid: PLUTO, title: "Pluto", disambiguation: null, lengthMs: 199293, artistMbid: BJORK },
  { mbid: ALL_IS_FULL_OF_LOVE, title: "All Is Full of Love", disambiguation: "Howie B mix, album version", lengthMs: 273106, artistMbid: BJORK },
  { mbid: ANGEL, title: "Angel", disambiguation: null, lengthMs: 378866, artistMbid: MASSIVE_ATTACK },
  { mbid: RISINGSON, title: "Risingson", disambiguation: null, lengthMs: 298800, artistMbid: MASSIVE_ATTACK },
  { mbid: TEARDROP, title: "Teardrop", disambiguation: null, lengthMs: 330026, artistMbid: MASSIVE_ATTACK },
  { mbid: INERTIA_CREEPS, title: "Inertia Creeps", disambiguation: null, lengthMs: 356960, artistMbid: MASSIVE_ATTACK },
  { mbid: EXCHANGE, title: "Exchange", disambiguation: null, lengthMs: 251200, artistMbid: MASSIVE_ATTACK },
  { mbid: DISSOLVED_GIRL, title: "Dissolved Girl", disambiguation: null, lengthMs: 366906, artistMbid: MASSIVE_ATTACK },
  { mbid: MAN_NEXT_DOOR, title: "Man Next Door", disambiguation: null, lengthMs: 356266, artistMbid: MASSIVE_ATTACK },
  { mbid: BLACK_MILK, title: "Black Milk", disambiguation: null, lengthMs: 381533, artistMbid: MASSIVE_ATTACK },
  { mbid: MEZZANINE_SONG, title: "Mezzanine", disambiguation: null, lengthMs: 356773, artistMbid: MASSIVE_ATTACK },
  { mbid: GROUP_FOUR, title: "Group Four", disambiguation: null, lengthMs: 492266, artistMbid: MASSIVE_ATTACK },
  { mbid: EXCHANGE_REPRISE, title: "(Exchange)", disambiguation: null, lengthMs: 250346, artistMbid: MASSIVE_ATTACK },
];

const MIRA = 1;
const JONAH = 2;
const SOFIA = 3;
const DEMO = 4;

export const SEED_USERS: MockUser[] = [
  { id: MIRA, email: "mira@trackmytracks.dev", username: "mira", password: "mira-listens-1" },
  { id: JONAH, email: "jonah@trackmytracks.dev", username: "jonah", password: "jonah-listens-2" },
  { id: SOFIA, email: "sofia@trackmytracks.dev", username: "sofia", password: "sofia-listens-3" },
  { id: DEMO, email: DEMO_LOGIN.email, username: "demo", password: DEMO_LOGIN.password },
];

type RatingRow = [id: number, userId: number, kind: Kind, mbid: string, score: number, review: string | null, day: number];

const RATING_ROWS: RatingRow[] = [
  [5, MIRA, "song", PARANOID_ANDROID, 10, null, 2],
  [6, MIRA, "song", KARMA_POLICE, 9, "The piano loop never resolves, so the last minute feels like the song leaving the room without you.", 3],
  [7, MIRA, "song", GLORY_BOX, 9, null, 4],
  [8, MIRA, "song", TEARDROP, 8, null, 5],
  [9, MIRA, "album", OK_COMPUTER, 10, "Every track sounds like a different room in the same building. Fitter Happier is the only misstep, and it still earns its place between the two halves.", 6],
  [10, MIRA, "album", DUMMY, 9, "Beth Gibbons sings like she is a few feet behind the speaker. Dry drums, deep bass, nothing wasted across eleven songs.", 8],
  [11, MIRA, "artist", RADIOHEAD, 9, null, 10],
  [12, JONAH, "song", RECKONER, 9, "The falsetto over the shaker is the most patient thing on In Rainbows, and the strings arrive exactly when you stop expecting them.", 3],
  [13, JONAH, "song", NUDE, 8, null, 4],
  [14, JONAH, "song", ANGEL, 9, null, 6],
  [15, JONAH, "song", SOUR_TIMES, 8, null, 7],
  [16, JONAH, "album", IN_RAINBOWS, 9, "Warmer than anything they made before it. Weird Fishes and Videotape carry the weight, and the record sounds loose in a way the earlier ones never did.", 9],
  [17, JONAH, "album", MEZZANINE, 8, null, 11],
  [18, JONAH, "artist", MASSIVE_ATTACK, 8, "Slow tempos, heavy low end, and guest vocalists who never feel bolted on. The sound is still hard to place.", 12],
  [19, SOFIA, "song", HUNTER, 8, null, 1],
  [20, SOFIA, "song", JOGA, 10, "The strings sound like tectonic plates moving. Her voice holds on top of them without ever pushing.", 2],
  [21, SOFIA, "song", ALL_IS_FULL_OF_LOVE, 9, null, 5],
  [22, SOFIA, "song", PEDESTAL, 7, null, 7],
  [23, SOFIA, "album", HOMOGENIC, 9, "Hard beats and a string octet, with her voice sitting right on top. The first half is stronger, but the ending earns the slower pace.", 13],
  [24, SOFIA, "album", MEZZANINE, 9, "Dense and a little suffocating in the best way. Teardrop gets the attention, but Inertia Creeps is where the album settles in.", 14],
  [25, SOFIA, "artist", BJORK, 9, null, 15],
  [26, DEMO, "song", AIRBAG, 9, null, 16],
  [27, DEMO, "song", NO_SURPRISES, 8, "Short and quiet, with a glockenspiel that does most of the work.", 17],
];

export const SEED_RATINGS: MockRating[] = RATING_ROWS.map(([id, userId, kind, mbid, score, review, day]) => ({
  id,
  userId,
  kind,
  mbid,
  score,
  review,
  updatedAt: `2026-09-${String(day).padStart(2, "0")}T18:30:00.000Z`,
}));

export const SEED_PLAYLISTS: MockPlaylist[] = [
  {
    id: 28,
    ownerId: MIRA,
    name: "Rainy tram rides",
    description: "Slow records for a long commute",
    isPublic: true,
    songs: [GLORY_BOX, NO_SURPRISES, EXIT_MUSIC, TEARDROP, ROADS, VIDEOTAPE],
    updatedAt: "2026-09-18T09:10:00.000Z",
  },
  {
    id: 29,
    ownerId: JONAH,
    name: "Bass first",
    description: "Songs where the low end leads",
    isPublic: true,
    songs: [ANGEL, RISINGSON, INERTIA_CREEPS, SOUR_TIMES, BODYSNATCHERS],
    updatedAt: "2026-09-20T21:45:00.000Z",
  },
  {
    id: 30,
    ownerId: SOFIA,
    name: "Strings and static",
    description: null,
    isPublic: true,
    songs: [JOGA, ALL_IS_FULL_OF_LOVE, UNRAVEL, EXIT_MUSIC, MYSTERONS],
    updatedAt: "2026-09-22T12:00:00.000Z",
  },
];
