import TrackCard from "./TrackCard";

const tracks = [
  {
    number: "01",
    title: "Midnight Drive",
    artist: "Neon Avenue",
    stars: "★★★★☆",
    rating: "4.4",
    coverClass: "cover-one"
  },
  {
    number: "02",
    title: "After Hours",
    artist: "Static Dreams",
    stars: "★★★★★",
    rating: "4.8",
    coverClass: "cover-two"
  },
  {
    number: "03",
    title: "Electric Blue",
    artist: "Night Shift",
    stars: "★★★★☆",
    rating: "4.2",
    coverClass: "cover-three"
  },
  {
    number: "04",
    title: "Replay",
    artist: "Echo Room",
    stars: "★★★★★",
    rating: "4.7",
    coverClass: "cover-four"
  }
];

function TrendingTracks() {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="section-label">
            WHAT'S PLAYING
          </p>

          <h2>
            Trending Tracks
          </h2>
        </div>

        <a href="#">
          View all →
        </a>
      </div>

      <div className="track-grid">
        {tracks.map((track) => (
          <TrackCard
            key={track.number}
            number={track.number}
            title={track.title}
            artist={track.artist}
            stars={track.stars}
            rating={track.rating}
            coverClass={track.coverClass}
          />
        ))}
      </div>
    </section>
  );
}

export default TrendingTracks;