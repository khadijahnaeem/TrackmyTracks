/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // 127.0.0.1 because Node resolves localhost to IPv6 first and Flask listens on IPv4
  server: { proxy: { "/api": "http://127.0.0.1:5001" } },
  // vitest resolves react-router to its CJS build without this, which splits the router context from react-router/dom
  resolve: { conditions: [...defaultClientConditions, "module-sync"] },
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts" },
});
