import type { ReactNode } from "react";
import { Card, Notice, PageHeader } from "../../ui";
import styles from "./auth.module.css";

interface AuthLayoutProps {
  title: string;
  error: string | null;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ title, error, footer, children }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <PageHeader title={title} />
      <Card>
        <div className={styles.stack}>
          {error && <Notice role="alert" tone="danger" title={error} />}
          {children}
        </div>
      </Card>
      <p className={styles.footer}>{footer}</p>
    </div>
  );
}
