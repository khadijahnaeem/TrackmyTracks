import { type TextareaHTMLAttributes, useId } from "react";
import { cx } from "./cx";
import styles from "./Field.module.css";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  value: string;
  maxLength: number;
  error?: string;
}

export function TextArea({ label, value, maxLength, error, id, ...rest }: TextAreaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const counterId = `${inputId}-counter`;
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        <span id={counterId} className={styles.counter}>
          {value.length} / {maxLength}
        </span>
      </div>
      <textarea
        id={inputId}
        value={value}
        maxLength={maxLength}
        className={cx(styles.control, styles.textarea)}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(counterId, error && errorId)}
        {...rest}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
