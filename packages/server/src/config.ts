/**
 * Server configuration & lifecycle inputs (Ticket 2.4).
 *
 * Resolves the effective configuration from (in precedence order):
 *   1. explicit overrides passed in code (tests, embedding),
 *   2. CLI flags,
 *   3. environment variables,
 *   4. built-in defaults.
 *
 * Transcript-path awareness: the introspection lib needs a Claude config-dir
 * root. Claude Code honours `CLAUDE_CONFIG_DIR`; when unset it defaults to
 * `~/.claude`. We surface that here so the MCP `anvil_introspect_transcript`
 * tool can resolve subagent transcripts without the caller knowing the host.
 */

import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { LogLevel } from './logger.js';

/** Fully-resolved server configuration. */
export interface ServerConfig {
  /** Absolute path to the results dir (`results/<runId>.json` + `index.json`). */
  resultsDir: string;
  /** Absolute path to the suites dir (parsed `*.yaml` eval suites). */
  evalsDir: string;
  /** Absolute path to the Claude config-dir root (for transcript resolution). */
  configRoot: string;
  /** HTTP/WS port for `serve` mode. */
  port: number;
  /** HTTP/WS bind host for `serve` mode. */
  host: string;
  /** When set, `serve` mode statically serves this built UI dir (`dist`). */
  uiDir?: string;
  /** Log level (stderr only). */
  logLevel: LogLevel;
}

/** Caller-supplied overrides (highest precedence). All optional. */
export interface ConfigOverrides {
  resultsDir?: string;
  evalsDir?: string;
  configRoot?: string;
  port?: number;
  host?: string;
  uiDir?: string;
  logLevel?: LogLevel;
}

/** The default Claude config-dir root, honouring `CLAUDE_CONFIG_DIR`. */
export function defaultConfigRoot(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env['CLAUDE_CONFIG_DIR'];
  if (fromEnv !== undefined && fromEnv.length > 0) return resolve(fromEnv);
  return join(homedir(), '.claude');
}

function envInt(value: string | undefined): number | undefined {
  if (value === undefined || value.trim().length === 0) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function isLogLevel(v: string | undefined): v is LogLevel {
  return v === 'debug' || v === 'info' || v === 'warn' || v === 'error' || v === 'silent';
}

/**
 * Resolve the effective {@link ServerConfig}. `cwd` anchors relative default
 * dirs (`results/`, `evals/`). `env` is injectable for tests.
 */
export function resolveConfig(
  overrides: ConfigOverrides = {},
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): ServerConfig {
  const cwd = opts.cwd ?? process.cwd();
  const env = opts.env ?? process.env;

  const resultsDir = resolve(
    overrides.resultsDir ?? env['ANVIL_RESULTS_DIR'] ?? join(cwd, 'results'),
  );
  const evalsDir = resolve(overrides.evalsDir ?? env['ANVIL_EVALS_DIR'] ?? join(cwd, 'evals'));
  const configRoot = overrides.configRoot
    ? resolve(overrides.configRoot)
    : env['ANVIL_CONFIG_ROOT']
      ? resolve(env['ANVIL_CONFIG_ROOT'])
      : defaultConfigRoot(env);

  const port = overrides.port ?? envInt(env['ANVIL_PORT']) ?? 4319;
  const host = overrides.host ?? env['ANVIL_HOST'] ?? '127.0.0.1';

  const uiDir = overrides.uiDir ?? env['ANVIL_UI_DIR'];

  const logLevel: LogLevel =
    overrides.logLevel ?? (isLogLevel(env['ANVIL_LOG_LEVEL']) ? env['ANVIL_LOG_LEVEL'] : 'info');

  return {
    resultsDir,
    evalsDir,
    configRoot,
    port,
    host,
    ...(uiDir !== undefined ? { uiDir: resolve(uiDir) } : {}),
    logLevel,
  };
}
