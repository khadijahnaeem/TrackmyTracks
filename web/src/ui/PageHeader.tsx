import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, eyebrow, meta, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <title>{`${title} | TrackmyTracks`}</title>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1>{title}</h1>
        {meta && <div className={styles.meta}>{meta}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
