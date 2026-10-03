import type { ReactNode } from "react";
import { errorMessage } from "../api/client";
import { Button } from "./Button";
import styles from "./Notice.module.css";

interface NoticeProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  role?: "status" | "alert";
}

export function Notice({ title, children, action, role = "status" }: NoticeProps) {
  return (
    <div role={role} className={styles.notice}>
      <p className={styles.title}>{title}</p>
      {children && <p className={styles.body}>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Notice
      role="alert"
      title="Something went wrong"
      action={onRetry && <Button onClick={onRetry}>Try again</Button>}
    >
      {errorMessage(error)}
    </Notice>
  );
}
