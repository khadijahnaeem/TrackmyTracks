import type { ReactNode } from "react";
import { Card, PageHeader } from "../../ui";
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
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {children}
      </Card>
      <p className={styles.footer}>{footer}</p>
    </div>
  );
}
