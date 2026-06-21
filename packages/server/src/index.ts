/**
 * @anvil/server — public API.
 *
 * Two run modes (Tickets 2.2–2.4), sharing one storage layer (2.1) and config
 * (2.4):
 *   - `mcp`   — stdio MCP server exposing tools to the model ({@link startMcpStdio}).
 *   - `serve` — companion REST/WS HTTP API for the UI ({@link AnvilHttpServer}).
 *
 * The `anvil-server` bin (src/bin/anvil-server.ts) dispatches to these by
 * subcommand. Everything here is also importable for embedding/tests.
 */

import { RESULT_SCHEMA_VERSION, EVAL_SCHEMA_VERSION } from '@anvil/core';

export interface ServerInfo {
  name: string;
  version: string;
  evalSchemaVersion: number;
  resultSchemaVersion: number;
}

export function serverInfo(): ServerInfo {
  return {
    name: 'anvil-server',
    version: '0.1.0',
    evalSchemaVersion: EVAL_SCHEMA_VERSION,
    resultSchemaVersion: RESULT_SCHEMA_VERSION,
  };
}

export { Storage, indexEntryFromScorecard } from './storage.js';
export { createLogger } from './logger.js';
export type { Logger, LogLevel } from './logger.js';
export { resolveConfig, defaultConfigRoot } from './config.js';
export type { ServerConfig, ConfigOverrides } from './config.js';
export { buildMcpServer, startMcpStdio } from './mcp.js';
export type { BuildMcpServerArgs } from './mcp.js';
export { AnvilHttpServer, startHttpServer } from './http.js';
export type { HttpServerOptions } from './http.js';
