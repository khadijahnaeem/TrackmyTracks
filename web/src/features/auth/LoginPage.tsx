import type { FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { errorMessage } from "../../api/client";
import { Button, TextField } from "../../ui";
import { useLogin } from "./api";
import { AuthLayout } from "./AuthLayout";
import styles from "./auth.module.css";
import { authHref, safeNext } from "./redirects";
import { useMe } from "./useMe";

export function LoginPage() {
  const { user } = useMe();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const login = useLogin();

  if (user) return <Navigate to={next ?? "/search"} replace />;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate({ email: String(form.get("email")), password: String(form.get("password")) });
  };

  return (
    <AuthLayout
      title="Log in"
      error={login.isError ? errorMessage(login.error) : null}
      footer={
        <>
          New to TrackmyTracks? <Link to={authHref("/register", next)}>Create an account</Link>
        </>
      }
    >
      <form className={styles.stack} onSubmit={handleSubmit}>
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" variant="primary" loading={login.isPending} className={styles.submit}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
