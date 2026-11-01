import { type FormEvent, useState } from "react";
import { Link, Navigate } from "react-router";
import type { Friends } from "../../api/types";
import { Button, Card, ErrorNotice, PageHeader, Skeleton, TextField } from "../../ui";
import { loginHref } from "../auth/redirects";
import { useMe } from "../auth/useMe";
import { FriendButton } from "./FriendButton";
import { useAcceptRequest, useFriends, useRemoveFriend, useUserSearch } from "./api";
import styles from "./FriendsPage.module.css";

export function FriendsPage() {
  const { user, isLoading } = useMe();
  const friends = useFriends();

  if (!isLoading && !user) return <Navigate to={loginHref("/friends")} replace />;

  return (
    <>
      <PageHeader title="Friends" />
      <div className={styles.page}>
        <FindPeople />
        {friends.isError ? (
          <ErrorNotice error={friends.error} title="Could not load your friends" onRetry={() => friends.refetch()} />
        ) : !friends.data ? (
          <div aria-busy="true" aria-label="Loading friends">
            <Skeleton width="min(20rem, 100%)" height="var(--leading-lg)" />
          </div>
        ) : (
          <Lists friends={friends.data} />
        )}
      </div>
    </>
  );
}

function FindPeople() {
  const [query, setQuery] = useState("");
  const search = useUserSearch(query);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(String(new FormData(event.currentTarget).get("q")).trim());
  };

  return (
    <section className={styles.find}>
      <form role="search" className={styles.search} onSubmit={handleSubmit}>
        <TextField label="Find people" name="q" placeholder="Search by username" maxLength={30} />
        <Button variant="primary" type="submit">
          Search
        </Button>
      </form>
      {search.isError && <ErrorNotice error={search.error} title="Could not search" />}
      {search.data &&
        (search.data.items.length === 0 ? (
          <p className={styles.empty}>No one found for "{query}"</p>
        ) : (
          <ul className={styles.list}>
            {search.data.items.map((person) => (
              <li key={person.username} className={styles.row}>
                <Link to={`/users/${person.username}/history`}>{person.username}</Link>
                <FriendButton username={person.username} />
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}

function Lists({ friends }: { friends: Friends }) {
  const accept = useAcceptRequest();
  const remove = useRemoveFriend();
  const isBusy = (username: string) =>
    (accept.isPending && accept.variables === username) || (remove.isPending && remove.variables === username);

  return (
    <div className={styles.columns}>
      <div className={styles.column}>
        <Card className={styles.card}>
          <h2 className={styles.heading}>Requests</h2>
          {friends.incoming.length === 0 ? (
            <p className={styles.empty}>No requests right now</p>
          ) : (
            <ul className={styles.list}>
              {friends.incoming.map(({ user }) => (
                <li key={user.username} className={styles.row}>
                  <span>{user.username}</span>
                  <span className={styles.actions}>
                    <Button
                      variant="primary"
                      className={styles.compact}
                      aria-label={`Accept ${user.username}`}
                      disabled={isBusy(user.username)}
                      onClick={() => accept.mutate(user.username)}
                    >
                      Accept
                    </Button>
                    <Button
                      className={styles.compact}
                      aria-label={`Decline ${user.username}`}
                      disabled={isBusy(user.username)}
                      onClick={() => remove.mutate(user.username)}
                    >
                      Decline
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className={styles.card}>
          <h2 className={styles.heading}>Sent</h2>
          {friends.outgoing.length === 0 ? (
            <p className={styles.empty}>No pending requests</p>
          ) : (
            <ul className={styles.list}>
              {friends.outgoing.map(({ user }) => (
                <li key={user.username} className={styles.row}>
                  <span>{user.username}</span>
                  <Button
                    className={styles.compact}
                    aria-label={`Cancel request to ${user.username}`}
                      disabled={isBusy(user.username)}
                      onClick={() => remove.mutate(user.username)}
                  >
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card className={styles.card}>
        <h2 className={styles.heading}>Your friends</h2>
        {friends.friends.length === 0 ? (
          <p className={styles.empty}>You haven't added anyone yet</p>
        ) : (
          <ul className={styles.list}>
            {friends.friends.map(({ user }) => (
              <li key={user.username} className={styles.row}>
                <Link to={`/users/${user.username}/history`}>{user.username}</Link>
                <span className={styles.actions}>
                  <Link
                    to={`/users/${user.username}/history`}
                    aria-label={`${user.username}'s history`}
                    className={styles.historyLink}
                  >
                    History
                  </Link>
                  <Button
                    className={styles.compact}
                    aria-label={`Unfriend ${user.username}`}
                      disabled={isBusy(user.username)}
                      onClick={() => remove.mutate(user.username)}
                  >
                    Unfriend
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
