// Flat ESLint config (ESLint v9). Lints TypeScript across all workspaces.
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/dist-types/**',
      '**/dist-types-node/**',
      '**/coverage/**',
      '**/node_modules/**',
      'External plugins/**',
      '.venv/**',
      // The static skill-showcase hub is plain browser HTML/JS deployed as-is,
      // not workspace TypeScript. Linting it with the Node config flags browser
      // globals (window, document) as undefined.
      'site/**',
      // Forgemaster run directories hold pipeline artifacts (stage records and
      // per-run acceptance-check scripts), not workspace code.
      'forgemaster-runs/**',
      // Benchmark task fixtures (hidden tests + reference solutions) run only
      // inside pinned Docker images with their own runtimes — Node 24 with
      // `using` declarations (06-event-emitter), CommonJS (08-spreadsheet),
      // and other languages — never imported by the harness. The workspace
      // lint config (espree @ ecmaVersion 2022, .mjs/.js globals) cannot parse
      // them and would false-flag valid fixture code. Same rationale as
      // site/** and forgemaster-runs/**: content, not workspace code.
      'bench/model-bench/tasks/**',
    ],
  },
  js.configs.recommended,
  {
    // Plain Node `.mjs`/`.js` build/maintenance scripts (e.g. the demo-data
    // validator) and plugin runtime code (e.g. bellows' MCP server). No TS
    // checker vouches for their globals, so declare them.
    files: ['**/scripts/**/*.{mjs,js}', 'plugins/**/*.{mjs,js}', 'bench/**/*.{mjs,js}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        TextDecoder: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        TextEncoder: 'readonly',
        AbortController: 'readonly',
        performance: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // TypeScript's own type checker handles undefined-symbol detection and is
      // aware of lib/Node globals; the core `no-undef` rule double-reports them.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
];
