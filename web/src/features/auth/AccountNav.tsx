import { Link, NavLink } from "react-router";
import { Button, buttonClassName, cx } from "../../ui";
import { useLogout } from "./api";
import styles from "./AccountNav.module.css";
import { useMe } from "./useMe";

const navClassName = ({ isActive }: { isActive: boolean }) => cx(styles.link, isActive && styles.active);

export function AccountNav() {
  const { user, isLoading } = useMe();
  const logout = useLogout();

  // nothing until the session is known, so the header never flashes the wrong state
  if (isLoading) return null;

  if (!user) {
    return (
      <div className={styles.account}>
        <Link to="/login" className={buttonClassName("ghost")}>
          Log in
        </Link>
        <Link to="/register" className={buttonClassName("primary")}>
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.account}>
      <nav aria-label="Account" className={styles.links}>
        <NavLink to={`/users/${user.username}/history`} className={navClassName}>
          History
        </NavLink>
        <NavLink to={`/users/${user.username}/playlists`} className={navClassName}>
          Playlists
        </NavLink>
      </nav>
      <span className={styles.username}>{user.username}</span>
      <Button variant="ghost" loading={logout.isPending} onClick={() => logout.mutate()}>
        Log out
      </Button>
    </div>
  );
}
