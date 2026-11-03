import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores([
    'dist',
    'dev-dist',
    'coverage',
    'playwright-report',
    'test-results',
    'blob-report',
    // Working folders that are not part of the site.
    '.dev',
    '.claude',
    '.superpowers',
    'docs',
  ]),
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    // Build tooling, scripts and end-to-end tests run in Node.
    files: ['*.{ts,js,mjs}', 'scripts/**', 'e2e/**'],
    languageOptions: { globals: globals.node },
  },
])
