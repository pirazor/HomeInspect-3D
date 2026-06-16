import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  // @mkkellogg/gaussian-splats-3d ships worker code; let Vite optimize it normally.
  optimizeDeps: { exclude: ["@mkkellogg/gaussian-splats-3d"] },
});
