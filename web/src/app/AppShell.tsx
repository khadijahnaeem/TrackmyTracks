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
            <Link to="/search" className={styles.brand}>
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
    </>
  );
}
