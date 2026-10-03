export function formatAverage(stars: number): string {
  return stars.toFixed(1);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${Math.floor(totalSeconds / 60)}:${seconds}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
