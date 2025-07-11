import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "coverage/",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/*.config.js",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
      ],
    },
    // Timeout for tests that might need to load OpenAPI specs
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
