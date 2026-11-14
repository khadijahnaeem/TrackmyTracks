
import { useId, useState, type SubmitEventHandler } from "react";
import { errorMessage } from "../../api/client";
import { Button, TextArea } from "../../ui";
import { useMe } from "../auth/useMe";
import { useCreateReport } from "./api";

type ReportButtonProps =
  | {
      ratingId: number;
      authorUsername: string;
      reportedUsername?: never;
    }
  | {
      reportedUsername: string;
      ratingId?: never;
      authorUsername?: never;
    };

export function ReportButton(props: ReportButtonProps) {
  const { user } = useMe();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const report = useCreateReport();
  const reasonId = useId();

  const targetUsername = props.reportedUsername ?? props.authorUsername;
  const isUserReport = props.reportedUsername !== undefined;

  const submit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    if (!reason.trim()) return;

    const input = isUserReport
      ? {
          reported_username: props.reportedUsername,
          reason: reason.trim(),
          details: details.trim() || undefined,
        }
      : {
          rating_id: props.ratingId,
          reason: reason.trim(),
          details: details.trim() || undefined,
        };

    report.mutate(input);
  };

  // Do not show reporting options to logged-out users
  // or users viewing their own content.
  if (!user || user.username === targetUsername) {
    return null;
  }

  if (report.isSuccess) {
    return <p role="status">Report submitted successfully.</p>;
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {isUserReport ? "Report user" : "Report review"}
      </Button>
    );
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={reasonId}>Reason for reporting</label>

      <input
        id={reasonId}
        value={reason}
        maxLength={100}
        required
        onChange={(event) => setReason(event.target.value)}
      />

      <TextArea
        label="Additional details (optional)"
        value={details}
        maxLength={1000}
        onChange={(event) => setDetails(event.target.value)}
      />

      {report.error && (
        <p role="alert">{errorMessage(report.error)}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        loading={report.isPending}
      >
        Submit report
      </Button>

      <Button
        variant="ghost"
        onClick={() => {
          report.reset();
          setOpen(false);
        }}
      >
        Cancel
      </Button>
    </form>
  );
}
