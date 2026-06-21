/**
 * Companion REST/WS API (Ticket 2.3) — for the UI's live mode.
 *
 * A plain Node `http` server (no framework — keeps deps light per the ticket)
 * plus a `ws` WebSocket server sharing the same port. Implements the contract
 * documented in `packages/ui/src/data/types.ts` EXACTLY:
 *
 *   GET  /api/results            → 200 RunIndex           (also the liveness probe)
 *   GET  /api/results/:runId     → 200 Scorecard | 404
 *   GET  /api/traces/:agentId    → 200 RunTrace  | 404    (404 tolerated)
 *   GET  /api/suites             → 200 EvalSuite[]
 *   WS   /api/ws                 → server→client pushes: scorecard | index | ping
 *
 * CORS is enabled for local dev (the UI dev server runs on a different origin).
 * Optionally serves a built UI dir statically for the one-command experience.
 *
 * Pushing: `saveScorecard()` persists via the storage layer THEN broadcasts a
 * `{type:"scorecard"}` and a refreshed `{type:"index"}` to all WS clients.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import type { RunIndexEntry } from '@anvil/core';
import type { Storage } from './storage.js';
import type { Logger } from './logger.js';

/** API base path (matches the UI default `VITE_ANVIL_API=/api`). */
const API_BASE = '/api';
const WS_PATH = `${API_BASE}/ws`;

/** A server→client push, narrowed to the UI's `LiveEvent` union. */
type LiveEvent =
  | { type: 'scorecard'; runId: string; entry: RunIndexEntry }
  | { type: 'index'; index: unknown }
  | { type: 'ping' };

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(text);
}

/** Options for {@link createHttpServer}. */
export interface HttpServerOptions {
  storage: Storage;
  logger?: Logger;
  /** When set, serve this built UI dir statically (SPA fallback to index.html). */
  uiDir?: string;
}

/**
 * The companion API server. Construct, then `listen(port, host)`; `close()` for
 * graceful shutdown. `saveScorecard()` is the write path that also broadcasts.
 */
export class AnvilHttpServer {
  private readonly storage: Storage;
  private readonly logger?: Logger;
  private readonly uiDir?: string;
  private readonly http: Server;
  private readonly wss: WebSocketServer;
  private readonly sockets = new Set<WebSocket>();
  private pingTimer?: NodeJS.Timeout;

  constructor(opts: HttpServerOptions) {
    this.storage = opts.storage;
    if (opts.logger !== undefined) this.logger = opts.logger;
    if (opts.uiDir !== undefined) this.uiDir = opts.uiDir;

    this.http = createServer((req, res) => {
      this.handle(req, res).catch((err: unknown) => {
        this.logger?.error('request handler error', (err as Error).message);
        if (!res.headersSent) sendJson(res, 500, { error: (err as Error).message });
        else res.end();
      });
    });

    // noServer: we drive the upgrade ourselves so only WS_PATH upgrades.
    this.wss = new WebSocketServer({ noServer: true });
    this.http.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== WS_PATH) {
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.sockets.add(ws);
        ws.on('close', () => this.sockets.delete(ws));
        ws.on('error', () => this.sockets.delete(ws));
        this.logger?.debug('ws client connected', String(this.sockets.size));
      });
    });
  }

  /** Broadcast a JSON event to every open WS client. */
  private broadcast(event: LiveEvent): void {
    const text = JSON.stringify(event);
    for (const ws of this.sockets) {
      // 1 === WebSocket.OPEN
      if (ws.readyState === 1) ws.send(text);
    }
  }

  /**
   * Persist a scorecard via the storage layer, then push `scorecard` + refreshed
   * `index` events to all WS clients. This is the hook the orchestration flow /
   * MCP layer can call to make a save visible live.
   */
  async saveScorecard(input: unknown): Promise<RunIndexEntry> {
    const { entry } = await this.storage.saveScorecard(input);
    this.broadcast({ type: 'scorecard', runId: entry.runId, entry });
    const index = await this.storage.readIndex();
    this.broadcast({ type: 'index', index });
    this.logger?.info('scorecard saved + broadcast', entry.runId);
    return entry;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (req.method === 'GET' && path === `${API_BASE}/results`) {
      const index = await this.storage.readIndex();
      sendJson(res, 200, index);
      return;
    }

    if (req.method === 'GET' && path.startsWith(`${API_BASE}/results/`)) {
      const runId = decodeURIComponent(path.slice(`${API_BASE}/results/`.length));
      const card = runId ? await this.storage.loadScorecard(runId) : null;
      if (!card) {
        sendJson(res, 404, { error: `no scorecard for runId "${runId}"` });
        return;
      }
      sendJson(res, 200, card);
      return;
    }

    if (req.method === 'GET' && path.startsWith(`${API_BASE}/traces/`)) {
      const agentId = decodeURIComponent(path.slice(`${API_BASE}/traces/`.length));
      const trace = agentId ? await this.storage.loadTrace(agentId) : null;
      if (!trace) {
        sendJson(res, 404, { error: `no trace for agentId "${agentId}"` });
        return;
      }
      sendJson(res, 200, trace);
      return;
    }

    if (req.method === 'GET' && path === `${API_BASE}/suites`) {
      const { suites } = await this.storage.listSuites();
      sendJson(res, 200, suites);
      return;
    }

    // Static UI (optional) — anything not under /api.
    if (req.method === 'GET' && this.uiDir && !path.startsWith(API_BASE)) {
      const served = await this.serveStatic(path, res);
      if (served) return;
    }

    sendJson(res, 404, { error: `not found: ${req.method} ${path}` });
  }

  /** Serve a static file from the UI dir, with SPA fallback to index.html. */
  private async serveStatic(path: string, res: ServerResponse): Promise<boolean> {
    if (this.uiDir === undefined) return false;
    // Prevent path traversal: normalize and reject any `..` escape.
    const rel = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '');
    if (rel.includes('..')) return false;
    const candidate = rel === '' ? 'index.html' : rel;
    const tryServe = async (file: string): Promise<boolean> => {
      const full = join(this.uiDir as string, file);
      try {
        const s = await stat(full);
        if (!s.isFile()) return false;
        const body = await readFile(full);
        res.writeHead(200, {
          'Content-Type': CONTENT_TYPES[extname(full)] ?? 'application/octet-stream',
        });
        res.end(body);
        return true;
      } catch {
        return false;
      }
    };
    if (await tryServe(candidate)) return true;
    // SPA fallback.
    return tryServe('index.html');
  }

  /** Start listening. Resolves with the actual bound port (useful for `port: 0`). */
  listen(port: number, host = '127.0.0.1'): Promise<number> {
    return new Promise((resolveListen, reject) => {
      const onError = (err: Error): void => reject(err);
      this.http.once('error', onError);
      this.http.listen(port, host, () => {
        this.http.removeListener('error', onError);
        const addr = this.http.address();
        const bound = typeof addr === 'object' && addr !== null ? addr.port : port;
        // Keep-alive pings so idle proxies don't drop the WS.
        this.pingTimer = setInterval(() => this.broadcast({ type: 'ping' }), 30_000);
        this.pingTimer.unref?.();
        this.logger?.info(`HTTP/WS listening on http://${host}:${bound}${API_BASE}`);
        resolveListen(bound);
      });
    });
  }

  /** Graceful shutdown: stop pings, close sockets, close servers. */
  close(): Promise<void> {
    return new Promise((resolveClose) => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      for (const ws of this.sockets) ws.close();
      this.sockets.clear();
      this.wss.close(() => {
        this.http.close(() => resolveClose());
      });
    });
  }
}

/** Convenience: build + start a companion server, returning it + bound port. */
export async function startHttpServer(
  opts: HttpServerOptions & { port: number; host?: string },
): Promise<{ server: AnvilHttpServer; port: number }> {
  const server = new AnvilHttpServer(opts);
  const port = await server.listen(opts.port, opts.host);
  return { server, port };
}
