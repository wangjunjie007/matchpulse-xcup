import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/matchpulse-xcup/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          wallet: ["viem"],
          ui: [
            "motion/react",
            "sonner",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-dialog"
          ]
        }
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5178
  }
});
