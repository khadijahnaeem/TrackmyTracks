function TrackCard({
  number,
  title,
  artist,
  rating,
  stars,
  coverClass
}) {
  return (
    <article className="track-card">
      <div className={`album-cover ${coverClass}`}>
        <span className="track-number">
          {number}
        </span>

        <button className="play-button">
          ▶
        </button>
      </div>

      <div className="track-info">
        <h3>{title}</h3>

        <p>{artist}</p>

        <div className="rating-row">
          <span className="stars">
            {stars}
          </span>

          <span className="score">
            {rating}
          </span>
        </div>
      </div>
    </article>
  );
}

export default TrackCard;