import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "complexity": "off",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always"],
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  {
    files: ["e2e/**/*"],
    rules: {
      "no-console": "off"
    }
  },
  {
    settings: {
      next: {
        rootDir: "apps/web/"
      }
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "**/node_modules/**",
    "**/.next/**",
    "**/.swc/**",
    "**/.vercel/**",
    "packages/**/dist/**",
    "next-env.d.ts",
    "qa_*.js",
  ]),
]);

export default eslintConfig;
