import { useParams } from "react-router";

export function useMbidParam(): string {
  const { mbid } = useParams();
  if (!mbid) throw new Error("Route is missing its :mbid segment");
  return mbid;
}
