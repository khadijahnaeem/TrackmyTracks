function ReviewCard({
  initial,
  username,
  time,
  stars,
  title,
  artist,
  text,
  featured
}) {
  return (
    <article
      className={
        featured
          ? "review-card featured-review"
          : "review-card"
      }
    >
      <div className="review-user">
        <div className="avatar">
          {initial}
        </div>

        <div>
          <strong>
            @{username}
          </strong>

          <p>
            {time}
          </p>
        </div>
      </div>

      <span className="stars">
        {stars}
      </span>

      <h3>
        {title}
      </h3>

      <p className="artist">
        {artist}
      </p>

      <p className="review-text">
        {text}
      </p>
    </article>
  );
}

export default ReviewCard;