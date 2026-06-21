/**
 * Tiny logger (Ticket 2.4).
 *
 * CRITICAL CONTRACT: in stdio MCP mode, stdout is the JSON-RPC channel and MUST
 * NOT be polluted by logs. Every log line therefore goes to **stderr**. The HTTP
 * `serve` mode uses the same logger for consistency.
 *
 * `level` gates verbosity; `silent` (used by tests) suppresses everything.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const ORDER: Record<Exclude<LogLevel, 'silent'>, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(msg: string, ...rest: unknown[]): void;
  info(msg: string, ...rest: unknown[]): void;
  warn(msg: string, ...rest: unknown[]): void;
  error(msg: string, ...rest: unknown[]): void;
}

/**
 * Create a logger that writes to stderr only. `level` controls the threshold;
 * `'silent'` disables all output.
 */
export function createLogger(level: LogLevel = 'info'): Logger {
  const threshold = level === 'silent' ? Number.POSITIVE_INFINITY : ORDER[level];
  const emit = (lvl: Exclude<LogLevel, 'silent'>, msg: string, rest: unknown[]): void => {
    if (ORDER[lvl] < threshold) return;
    const ts = new Date().toISOString();
    const line = `[anvil ${ts}] ${lvl.toUpperCase()} ${msg}`;
    // Always stderr — never stdout (keeps the MCP JSON-RPC channel clean).
    process.stderr.write(rest.length > 0 ? `${line} ${rest.map(String).join(' ')}\n` : `${line}\n`);
  };
  return {
    debug: (msg, ...rest) => emit('debug', msg, rest),
    info: (msg, ...rest) => emit('info', msg, rest),
    warn: (msg, ...rest) => emit('warn', msg, rest),
    error: (msg, ...rest) => emit('error', msg, rest),
  };
}
