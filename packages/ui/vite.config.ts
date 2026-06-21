import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

const nodeShim = fileURLToPath(new URL('./src/shims/node-empty.ts', import.meta.url));

/**
 * Vite config for the Anvil dashboard.
 *
 * `base` controls the public path the built assets + the `data/` fetches resolve
 * against. For a GitHub Pages *project site* (https://user.github.io/<repo>/) the
 * base must be `/<repo>/`. We make it configurable via `ANVIL_BASE` and default
 * to `'./'` (a *relative* base) so the build is Pages-compatible out of the box —
 * `data/index.json` resolves relative to wherever index.html is served from,
 * whether that's the domain root, a project subpath, or a `file://` open.
 *
 * The config is a function so the Node-built-in shim alias is applied ONLY for
 * the browser build/serve — never under Vitest, whose node tests need the real
 * `node:fs` / `node:path`.
 */
export default defineConfig(({ mode }) => {
  const isTest = mode === 'test' || process.env.VITEST !== undefined;
  const alias: Record<string, string> = isTest
    ? {}
    : { 'node:fs': nodeShim, 'node:path': nodeShim, 'node:crypto': nodeShim };
  return {
    base: process.env.ANVIL_BASE ?? './',
    // Cast guards against a duplicate `vite` type identity when the root
    // toolchain pins an older vite (via vitest) than this package's vite.
    plugins: [react() as PluginOption],
    resolve: {
      // @anvil/core's barrel re-exports Node-only modules (introspect/scoring/
      // cache) that import node:fs / node:path / node:crypto at top level. The
      // UI never calls them (only the pure schemas + parse helpers), so Rollup
      // tree-shakes the bodies; these shims just satisfy the bare imports in a
      // browser bundle. Skipped under Vitest so node tests get the real built-ins.
      alias,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  };
});
