import { useMe } from "../auth/useMe";
import { FriendsActivity } from "../friends/FriendsActivity";
import { FreshReviews } from "./FreshReviews";
import { Hero } from "./Hero";
import styles from "./HomePage.module.css";
import { TrendingTracks } from "./TrendingTracks";

export function HomePage() {
  const { user, isLoading } = useMe();

  return (
    <div className={styles.page}>
      <title>TrackmyTracks</title>
      <h1 className="visually-hidden">TrackmyTracks</h1>
      <Hero />
      <TrendingTracks />
      {user && !isLoading ? <FriendsActivity /> : <FreshReviews />}
    </div>
  );
}
