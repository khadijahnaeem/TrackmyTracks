import { FreshReviews } from "./FreshReviews";
import { Hero } from "./Hero";
import styles from "./HomePage.module.css";
import { TrendingTracks } from "./TrendingTracks";

export function HomePage() {
  return (
    <div className={styles.page}>
      <title>TrackmyTracks</title>
      <h1 className="visually-hidden">TrackmyTracks</h1>
      <Hero />
      <TrendingTracks />
      <FreshReviews />
    </div>
  );
}
