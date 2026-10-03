function Hero() {
  return (
    <section className="hero">
      <div className="hero-glow glow-one"></div>
      <div className="hero-glow glow-two"></div>

      <p className="hero-label">
        YOUR MUSIC. YOUR RATINGS.
      </p>

      <h1>
        Every track deserves
        <span>a rating.</span>
      </h1>

      <p className="hero-description">
        Rate songs, review albums, discover new artists,
        and keep track of everything worth replaying.
      </p>

      <div className="search-box">
        <span className="search-icon">⌕</span>

        <input
          type="text"
          placeholder="Search songs, albums, or artists..."
        />

        <button>
          SEARCH
        </button>
      </div>

      <div className="hero-stats">
        <div>
          <strong>★★★★★</strong>
          <span>Rate your favorites</span>
        </div>

        <div>
          <strong>♫</strong>
          <span>Discover new music</span>
        </div>

        <div>
          <strong>✎</strong>
          <span>Write your reviews</span>
        </div>
      </div>
    </section>
  );
}

export default Hero;