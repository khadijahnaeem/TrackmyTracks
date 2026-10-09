import "@fontsource-variable/fraunces";
import "@fontsource-variable/public-sans";
import "./ui/tokens.css";
import "./ui/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

// the mock only loads in dev:mock, so builds never bundle it
if (import.meta.env.MODE === "mock") await (await import("./mocks/browser")).startMockApi();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
