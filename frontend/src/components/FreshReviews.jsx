import ReviewCard from "./Reviewcard";

const reviews = [
  {
    initial: "K",
    username: "khadijah",
    time: "just now",
    stars: "★★★★★",
    title: "Midnight Drive",
    artist: "Neon Avenue",
    text:
      "This is one of those songs you immediately want to replay the second it ends."
  },

  {
    initial: "S",
    username: "sam",
    time: "12 min ago",
    stars: "★★★★☆",
    title: "Electric Blue",
    artist: "Night Shift",
    text:
      "The production is insane. Easily one of my favorite tracks from the album.",
    featured: true
  },

  {
    initial: "E",
    username: "eyan",
    time: "28 min ago",
    stars: "★★★★★",
    title: "Replay",
    artist: "Echo Room",
    text:
      "Exactly what I want from a late-night playlist."
  }
];

function FreshReviews() {
  return (
    <section className="content-section reviews-section">
      <div className="section-heading">
        <div>
          <p className="section-label">
            THE COMMUNITY
          </p>

          <h2>
            Fresh Reviews
          </h2>
        </div>

        <a href="#">
          More reviews →
        </a>
      </div>

      <div className="review-grid">
        {reviews.map((review) => (
          <ReviewCard
            key={review.username}
            initial={review.initial}
            username={review.username}
            time={review.time}
            stars={review.stars}
            title={review.title}
            artist={review.artist}
            text={review.text}
            featured={review.featured}
          />
        ))}
      </div>
    </section>
  );
}

export default FreshReviews;