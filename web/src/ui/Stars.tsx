import { type KeyboardEvent, type MouseEvent, useState } from "react";
import { cx } from "./cx";
import { formatAverage } from "./format";
import styles from "./Stars.module.css";

const STAR_PATH = "M12 2l2.9 6.26 6.9.74-5.13 4.66 1.43 6.79L12 17.27 5.9 20.45l1.43-6.79L2.2 9l6.9-.74z";

// derived values like 3.7 step to the next half star in the pressed direction
const stepUp = (current: number) => Math.floor(current * 2 + 1) / 2;
const stepDown = (current: number) => Math.ceil(current * 2 - 1) / 2;

const KEY_STEPS: Record<string, (current: number) => number> = {
  ArrowRight: stepUp,
  ArrowUp: stepUp,
  ArrowLeft: stepDown,
  ArrowDown: stepDown,
  Home: () => 0.5,
  End: () => 5,
};

interface StarsProps {
  value: number | null;
  label: string;
  onChange?: (stars: number) => void;
  size?: "sm" | "md";
  describedBy?: string;
}

function clamp(stars: number): number {
  return Math.min(5, Math.max(0.5, stars));
}

function StarRow({ className }: { className: string }) {
  return (
    <span className={cx(styles.row, className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={styles.star} aria-hidden>
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

export function Stars({ value, label, onChange, size = "md", describedBy }: StarsProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value ?? 0;
  const className = cx(styles.stars, styles[size], onChange && styles.interactive);
  const body = (
    <>
      <StarRow className={styles.empty} />
      <span className={styles.fill} style={{ width: `${(shown / 5) * 100}%` }}>
        <StarRow className={styles.filled} />
      </span>
    </>
  );

  if (!onChange) {
    const description = value === null ? "not rated" : `${formatAverage(value)} out of 5`;
    return (
      <span role="img" aria-label={`${label}: ${description}`} className={className}>
        {body}
      </span>
    );
  }

  const starsAt = (event: MouseEvent<HTMLSpanElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return clamp(Math.ceil(((event.clientX - rect.left) / rect.width) * 10) / 2);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const next = clamp(step(value ?? 0));
    if (next !== value) onChange(next);
  };

  return (
    <span
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={value ?? undefined}
      aria-describedby={describedBy}
      aria-valuetext={value === null ? "Not rated" : `${value} out of 5 stars`}
      className={className}
      onPointerMove={(event) => setPreview(starsAt(event))}
      onPointerLeave={() => setPreview(null)}
      onClick={(event) => onChange(starsAt(event))}
      onKeyDown={handleKeyDown}
    >
      {body}
    </span>
  );
}
