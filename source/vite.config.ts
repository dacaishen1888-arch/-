import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { "grok/canvas": path.join(root, "src/canvas.tsx") } },
  test: { environment: "happy-dom", include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"] },
});
