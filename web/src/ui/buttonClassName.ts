import styles from "./Button.module.css";
import { cx } from "./cx";

export type Variant = "primary" | "secondary" | "ghost";

export function buttonClassName(variant: Variant = "secondary"): string {
  return cx(styles.button, styles[variant]);
}
