import styles from "./Button.module.css";
import { cx } from "./cx";

export type Variant = "primary" | "secondary" | "ghost" | "danger";

export function buttonClassName(variant: Variant = "secondary"): string {
  return cx(styles.button, styles[variant]);
}
