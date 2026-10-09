import { delay, http } from "msw";
import { setupWorker } from "msw/browser";
import { authHandlers } from "./handlers/auth";
import { catalogHandlers } from "./handlers/catalog";
import { historyHandlers } from "./handlers/history";
import { playlistsHandlers } from "./handlers/playlists";
import { ratingsHandlers } from "./handlers/ratings";
import { isUnhandledApiRequest } from "./respond";
import { forgetState, STORAGE_KEY } from "./store";

const worker = setupWorker(
  // unresolved, so every api request waits before the real handler answers
  http.all("/api/*", async () => {
    await delay(250);
  }),
  ...authHandlers,
  ...catalogHandlers,
  ...ratingsHandlers,
  ...playlistsHandlers,
  ...historyHandlers,
);

export async function startMockApi(): Promise<void> {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) forgetState();
  });
  await worker.start({
    onUnhandledRequest(request, print) {
      if (isUnhandledApiRequest(request)) print.warning();
    },
  });
}
