import "@fontsource-variable/fraunces";
import "@fontsource-variable/public-sans";
import "./ui/tokens.css";
import "./ui/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
