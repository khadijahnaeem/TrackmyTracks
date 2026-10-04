import { Link, NavLink, Outlet } from "react-router";
import { cx } from "../ui";
import styles from "./AppShell.module.css";

const navClassName = ({ isActive }: { isActive: boolean }) => cx(styles.link, isActive && styles.active);

export function AppShell() {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <nav className={styles.nav} aria-label="Main">
            <Link to="/" className={styles.brand}>
              TrackmyTracks
            </Link>
            <NavLink to="/search" className={navClassName}>
              Search
            </NavLink>
          </nav>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={styles.bar}>
          <p className={styles.brand}>TrackmyTracks</p>
          <p className={styles.tagline}>Rate it. Review it. Replay it.</p>
        </div>
      </footer>
    </>
  );
}
