/**
 * Browser shim for the Node built-ins that @anvil/core's Node-only modules
 * (introspect.js / scoring.js) import at module top-level. The UI never calls
 * those code paths — only the pure schema + parse helpers — so Rollup
 * tree-shakes the bodies, but the bare `import { join } from 'node:path'`
 * statements still need named exports to resolve in a browser bundle. These
 * throwing stubs satisfy resolution without pulling Node into the bundle.
 */
function unavailable(name: string): never {
  throw new Error(`@anvil/ui: Node built-in "${name}" is not available in the browser bundle`);
}

export function readFileSync(): never {
  return unavailable('fs.readFileSync');
}
export function existsSync(): never {
  return unavailable('fs.existsSync');
}
export function readdirSync(): never {
  return unavailable('fs.readdirSync');
}
export function statSync(): never {
  return unavailable('fs.statSync');
}
export function join(...parts: string[]): string {
  return parts.join('/');
}
export function isAbsolute(p: string): boolean {
  return p.startsWith('/');
}
export function createHash(): never {
  return unavailable('crypto.createHash');
}

export default { readFileSync, existsSync, readdirSync, statSync, join, isAbsolute, createHash };
