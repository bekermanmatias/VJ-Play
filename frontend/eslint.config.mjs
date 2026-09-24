import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "storybook-static/**", "node_modules/**", "test-results/**", ".astro/**"] },
  ...astro.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx,js,jsx}", "tests/**/*.{ts,tsx,js,jsx}"],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "react-hooks": reactHooks },
    rules: { "no-duplicate-imports": "error", "no-unreachable": "error", "react-hooks/exhaustive-deps": "warn" },
  },
];
