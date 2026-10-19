import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub project pages live under /<repo>/. Local development and the static
// preview server stay at /.
const base = process.env.GITHUB_PAGES === "true" ? "/Kanjidamage-Atlas/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
