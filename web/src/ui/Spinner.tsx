import { cx } from "./cx";
import styles from "./Spinner.module.css";

interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label = "Loading", className }: SpinnerProps) {
  return <span role="status" aria-label={label} className={cx(styles.spinner, className)} />;
}
