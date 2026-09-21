import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "packages/snapshot/**",
      "packages/layouts/*/*.json",
      ".vercel/**",
    ],
  },
  js.configs.recommended,
  // Non-type-aware baseline for every TS/JS file, including test files and root-level
  // config/scripts — none of those are part of any package's build tsconfig, so they
  // can't be given type-aware linting below without inventing a synthetic tsconfig.
  ...tseslint.configs.recommended,
  {
    // Node-context scripts (ingest CI check, layout generator/validator) — these run
    // under `node`, not a bundler, so they need Node's globals rather than none at all.
    files: ["**/*.mjs", "**/*.cjs", "eslint.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Type-aware linting, scoped to exactly what each package's own tsconfig already
    // compiles (every package uses `include: ["src"]`) — so typescript-eslint's project
    // service can always resolve every file it's asked to check, with no extra config.
    files: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // React + accessibility rules, scoped to the web app only — the other
    // workspaces (packages/*, apps/etl) are plain TS with no JSX.
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": "warn",
      ...jsxA11y.flatConfigs.recommended.rules,
    },
    languageOptions: {
      ...jsxA11y.flatConfigs.recommended.languageOptions,
    },
  },
  eslintConfigPrettier,
);
