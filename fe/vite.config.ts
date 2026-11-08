import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackRouter(), react()],
  server: {
    // Same-origin in production (ADR 21); the Vite proxy mirrors /api locally.
    proxy: { "/api": "http://localhost:3000" },
  },
});
