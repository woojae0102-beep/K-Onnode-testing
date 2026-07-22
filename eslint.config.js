import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** 기존 eslint-disable(react-hooks/*) 주석 호환 — 규칙 본체는 비활성 */
const noopRule = { create: () => ({}) };
const reactHooksCompat = { rules: { 'exhaustive-deps': noopRule } };
const reactCompat = { rules: { 'no-unknown-property': noopRule } };

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'public/**',
      'node_modules/**',
      'api/**',
      'lib/**',
      'scripts/**',
      '**/*.cjs',
    ],
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooksCompat,
      react: reactCompat,
    },
    rules: {
      /** 선언되지 않은 변수 — ReferenceError 예방 (normalized is not defined 등) */
      'no-undef': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-useless-assignment': 'off',
      'no-empty': 'off',
      'prefer-const': 'off',
      'no-useless-escape': 'off',
      'preserve-caught-error': 'off',
    },
  },
  {
    files: ['src/**/*.test.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
