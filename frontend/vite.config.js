import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  server: {
    fs: {
      allow: [rootDir],
    },
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
});
