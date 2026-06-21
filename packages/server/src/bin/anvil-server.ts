#!/usr/bin/env node
/**
 * `anvil-server` entrypoint (Ticket 2.4).
 *
 * One bin, two modes via a subcommand:
 *   anvil-server mcp     — stdio MCP server (what `.mcp.json` launches). stdout is
 *                          the JSON-RPC channel; ALL logs go to stderr.
 *   anvil-server serve   — companion REST/WS HTTP API for the UI.
 *   anvil-server info    — print server/schema info as JSON (smoke probe).
 *
 * Flags (override env, which overrides defaults):
 *   --results-dir <dir>   (env ANVIL_RESULTS_DIR)   default: ./results
 *   --evals-dir <dir>     (env ANVIL_EVALS_DIR)     default: ./evals
 *   --config-root <dir>   (env ANVIL_CONFIG_ROOT / CLAUDE_CONFIG_DIR)  default: ~/.claude
 *   --port <n>            (env ANVIL_PORT)          default: 4319         [serve]
 *   --host <h>            (env ANVIL_HOST)          default: 127.0.0.1    [serve]
 *   --ui-dir <dir>        (env ANVIL_UI_DIR)        serve UI statically   [serve]
 *   --log-level <lvl>     (env ANVIL_LOG_LEVEL)     default: info (mcp forces stderr)
 */

import { serverInfo } from '../index.js';
import { resolveConfig, type ConfigOverrides } from '../config.js';
import { createLogger, type LogLevel } from '../logger.js';
import { Storage } from '../storage.js';
import { startMcpStdio } from '../mcp.js';
import { AnvilHttpServer } from '../http.js';

/** Parse `--flag value` / `--flag=value` pairs into a map. */
function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === undefined || !tok.startsWith('--')) continue;
    const eq = tok.indexOf('=');
    if (eq >= 0) {
      flags.set(tok.slice(2, eq), tok.slice(eq + 1));
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(tok.slice(2), next);
        i += 1;
      } else {
        flags.set(tok.slice(2), 'true');
      }
    }
  }
  return flags;
}

function overridesFromFlags(flags: Map<string, string>): ConfigOverrides {
  const o: ConfigOverrides = {};
  const rd = flags.get('results-dir');
  const ed = flags.get('evals-dir');
  const cr = flags.get('config-root');
  const port = flags.get('port');
  const host = flags.get('host');
  const ui = flags.get('ui-dir');
  const ll = flags.get('log-level');
  if (rd !== undefined) o.resultsDir = rd;
  if (ed !== undefined) o.evalsDir = ed;
  if (cr !== undefined) o.configRoot = cr;
  if (port !== undefined && Number.isInteger(Number(port))) o.port = Number(port);
  if (host !== undefined) o.host = host;
  if (ui !== undefined) o.uiDir = ui;
  if (ll === 'debug' || ll === 'info' || ll === 'warn' || ll === 'error' || ll === 'silent') {
    o.logLevel = ll as LogLevel;
  }
  return o;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0] ?? 'mcp';
  const flags = parseFlags(argv.slice(1));
  const overrides = overridesFromFlags(flags);
  const config = resolveConfig(overrides);

  if (command === 'info') {
    process.stdout.write(`${JSON.stringify(serverInfo())}\n`);
    return;
  }

  const storage = new Storage({ resultsDir: config.resultsDir, evalsDir: config.evalsDir });

  if (command === 'mcp') {
    // stdio mode: stdout reserved for JSON-RPC; logger writes only to stderr.
    const logger = createLogger(config.logLevel);
    logger.info(
      `starting MCP stdio (results=${config.resultsDir}, evals=${config.evalsDir}, configRoot=${config.configRoot})`,
    );
    await startMcpStdio({ storage, configRoot: config.configRoot, logger });
    // The stdio transport keeps the process alive; nothing more to do.
    return;
  }

  if (command === 'serve') {
    const logger = createLogger(config.logLevel);
    const server = new AnvilHttpServer({
      storage,
      logger,
      ...(config.uiDir !== undefined ? { uiDir: config.uiDir } : {}),
    });
    const port = await server.listen(config.port, config.host);
    logger.info(`anvil serve ready on http://${config.host}:${port}/api`);

    const shutdown = (): void => {
      logger.info('shutting down…');
      server
        .close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  process.stderr.write(
    `unknown command "${command}". Use: anvil-server <mcp|serve|info> [flags]\n`,
  );
  process.exit(2);
}

main().catch((err: unknown) => {
  process.stderr.write(`fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
