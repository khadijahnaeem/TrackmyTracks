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

const COMPACT_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

export function pluralize(count: number, noun: string): string {
  return `${count} ${plural(count, noun)}`;
}

// big counts read as 3.9M rather than 3,893,589
export function formatCount(count: number, noun: string): string {
  return `${COMPACT_FORMAT.format(count)} ${plural(count, noun)}`;
}
