import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      // The map stack and Sentry are the heavy, rarely-changing halves; keep
      // them out of the app chunk so a screen edit doesn't re-download them.
      output: { manualChunks: { leaflet: ["leaflet", "react-leaflet"], sentry: ["@sentry/react"] } },
    },
  },
});
