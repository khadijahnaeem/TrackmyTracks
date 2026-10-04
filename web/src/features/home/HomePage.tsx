import { Hero } from "./Hero";
import styles from "./HomePage.module.css";

export function HomePage() {
  return (
    <div className={styles.page}>
      <title>TrackmyTracks</title>
      <h1 className="visually-hidden">TrackmyTracks</h1>
      <Hero />
    </div>
  );
}
