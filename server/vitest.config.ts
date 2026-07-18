import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
    fileParallelism: false,
    env: {
      // Never let integration tests share the development upload directory.
      EVIDENCE_DIR: "./test-results/evidence",
    },
  },
});
