import { errorMessage } from "../api/client";
import styles from "./Field.module.css";

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className={styles.error}>
      {errorMessage(error)}
    </p>
  );
}
