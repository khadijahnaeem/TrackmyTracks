import styles from "./HomePage.module.css";

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
}

export function SectionHeading({ id, eyebrow, title }: SectionHeadingProps) {
  return (
    <div className={styles.heading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
    </div>
  );
}
