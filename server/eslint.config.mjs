import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "src/generated/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-console": "error",
    },
  },
  {
    // The seed script and tests may log freely.
    files: ["prisma/**/*.ts", "tests/**/*.ts"],
    rules: { "no-console": "off" },
  }
)
