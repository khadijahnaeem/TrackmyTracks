import type { ReactNode } from "react";
import styles from "./Card.module.css";
import { cx } from "./cx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.card, className)}>{children}</div>;
}
