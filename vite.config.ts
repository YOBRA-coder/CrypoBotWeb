// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "https://cryptobotapi.onrender.com", changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
    },
    allowedHosts: true,
  }
});
