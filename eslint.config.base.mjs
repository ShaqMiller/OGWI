// Shared ESLint flat-config rules for TypeScript workspaces (apps/api, packages/shared).
// apps/web uses Next.js's own eslint config instead (see apps/web/eslint.config.mjs).
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export const baseConfig = [
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**', '**/*.js'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
