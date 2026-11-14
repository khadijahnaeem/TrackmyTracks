import { useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";


type ReportInput =
  | {
    rating_id: number;
    reported_username?: never;
    reason: string;
    details?: string;
    }
  | {
    reported_username: string;
    rating_id?: never;
    reason: string;
    details?: string;
    };

interface ReportResponse {
  id: number;
  status: string;
}


export function useCreateReport() {
  return useMutation({
    mutationFn: (input: ReportInput) =>
      api.post<ReportResponse>("/reports", input),
  });
}
