import type { FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { errorMessage } from "../../api/client";
import { Button, TextField } from "../../ui";
import { useRegister } from "./api";
import { AuthLayout } from "./AuthLayout";
import styles from "./auth.module.css";
import { authHref, safeNext } from "./redirects";
import { useMe } from "./useMe";

export function RegisterPage() {
  const { user } = useMe();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const register = useRegister();

  if (user) return <Navigate to={next ?? "/search"} replace />;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    register.mutate({
      email: String(form.get("email")),
      username: String(form.get("username")),
      password: String(form.get("password")),
    });
  };

  return (
    <AuthLayout
      title="Create an account"
      error={register.isError ? errorMessage(register.error) : null}
      footer={
        <>
          Already have an account? <Link to={authHref("/login", next)}>Log in</Link>
        </>
      }
    >
      <form className={styles.stack} onSubmit={handleSubmit}>
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Username"
          name="username"
          autoComplete="username"
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_]+"
          title="Letters, numbers, or underscores"
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
        <Button
          type="submit"
          variant="primary"
          loading={register.isPending}
          className={styles.submit}
        >
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
