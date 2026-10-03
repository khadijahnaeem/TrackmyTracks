import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string;
  height?: string;
}

export function Skeleton({ width = "100%", height = "var(--leading-base)" }: SkeletonProps) {
  return <span aria-hidden className={styles.skeleton} style={{ width, height }} />;
}
