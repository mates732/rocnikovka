import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Development proxy target for the Node backend in ./server.
 * This only applies to `npm run dev` — it is NOT part of the production build.
 *
 * In production the frontend is a static bundle. The backend must be hosted
 * separately and its origin assigned to VITE_API_BASE_URL at build time; see
 * src/data/apiBase.ts and .env.example.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
