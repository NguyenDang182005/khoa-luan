import { config } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    rules: {
      // NestJS: @Request() req, catch (err) và payload n8n dùng any có chủ đích.
      "@typescript-eslint/no-explicit-any": "off",
      // Biến bắt đầu bằng _ dùng để bỏ field khi destructure.
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    },
  },
];
