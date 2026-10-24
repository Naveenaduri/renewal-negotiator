import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside React Server Components; stub it for unit tests.
      "server-only": path.resolve(import.meta.dirname, "test/server-only-stub.ts"),
    },
  },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
