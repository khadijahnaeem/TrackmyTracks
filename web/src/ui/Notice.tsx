import type { ReactNode } from "react";
import { errorMessage } from "../api/client";
import { Button } from "./Button";
import { cx } from "./cx";
import styles from "./Notice.module.css";

interface NoticeProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  role?: "status" | "alert";
  tone?: "neutral" | "danger";
}

export function Notice({ title, children, action, role = "status", tone = "neutral" }: NoticeProps) {
  return (
    <div role={role} className={cx(styles.notice, tone === "danger" && styles.danger)}>
      <p className={styles.title}>{title}</p>
      {children && <p className={styles.body}>{children}</p>}
      {action}
    </div>
  );
}

interface ErrorNoticeProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

export function ErrorNotice({ error, onRetry, title = "Something went wrong" }: ErrorNoticeProps) {
  return (
    <Notice
      role="alert"
      title={title}
      action={onRetry && <Button onClick={onRetry}>Try again</Button>}
    >
      {errorMessage(error)}
    </Notice>
  );
}
