import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Config de tests unitarios (Vitest).
 *
 * Los tests de Playwright viven en `tests/*.spec.ts` y se corren con
 * `npm run test:responsive`; acá sólo tomamos `tests/unit/**`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
