import { Button } from "./Button";
import styles from "./Pagination.module.css";

interface PaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ page, pages, onPageChange, disabled = false }: PaginationProps) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className={styles.pagination}>
      <Button variant="ghost" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className={styles.status}>
        Page {page} of {pages}
      </span>
      <Button variant="ghost" disabled={disabled || page >= pages} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </nav>
  );
}
