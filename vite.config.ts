import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const GITHUB_PAGES_BASE = "/daydock/";

export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? GITHUB_PAGES_BASE : "/",
  plugins: [react()],
}));
