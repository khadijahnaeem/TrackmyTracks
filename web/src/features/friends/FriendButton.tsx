import { Button } from "../../ui";
import { useMe } from "../auth/useMe";
import { friendStatus, useAcceptRequest, useFriends, useSendRequest } from "./api";
import styles from "./FriendButton.module.css";

interface FriendButtonProps {
  username: string;
}

export function FriendButton({ username }: FriendButtonProps) {
  const { user } = useMe();
  const friends = useFriends();
  const sendRequest = useSendRequest();
  const acceptRequest = useAcceptRequest();

  if (!user || user.username === username || !friends.data) return null;

  const status = friendStatus(friends.data, username);
  if (status === "friends") return <span className={styles.muted}>Friends</span>;
  if (status === "sent") return <span className={styles.muted}>Request sent</span>;
  if (status === "received") {
    return (
      <Button
        className={styles.compact}
        aria-label={`Accept ${username}'s request`}
        loading={acceptRequest.isPending}
        onClick={() => acceptRequest.mutate(username)}
      >
        Accept
      </Button>
    );
  }
  return (
    <Button
      className={styles.compact}
      aria-label={`Add ${username} as a friend`}
      loading={sendRequest.isPending}
      onClick={() => sendRequest.mutate(username)}
    >
      Add friend
    </Button>
  );
}
