import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button, TextField } from "../../ui";
import styles from "./HomePage.module.css";

export function Hero() {
  const navigate = useNavigate();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q")).trim();
    if (q) navigate({ pathname: "/search", search: `?${new URLSearchParams({ q })}` });
  };

  return (
    <form role="search" className={styles.search} onSubmit={handleSubmit}>
      <TextField
        label="Search music"
        hideLabel
        name="q"
        placeholder="Search songs, albums, or artists"
        maxLength={200}
      />
      <Button variant="primary" type="submit">
        Search
      </Button>
    </form>
  );
}
