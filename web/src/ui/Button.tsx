import type { ComponentProps } from "react";
import styles from "./Button.module.css";
import { cx } from "./cx";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost";

// ComponentProps includes ref, which React 19 passes as a regular prop
interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  loading?: boolean;
}

export function buttonClassName(variant: Variant = "secondary"): string {
  return cx(styles.button, styles[variant]);
}

export function Button({
  variant = "secondary",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClassName(variant), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={styles.label}>{children}</span>
      {loading && <Spinner className={styles.spinner} />}
    </button>
  );
}
