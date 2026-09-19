import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? "/Employees-template-React-App/" : "/",
  plugins: [react()],
}));
