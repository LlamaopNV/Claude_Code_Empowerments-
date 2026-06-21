import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { EvalSuiteSchema, type EvalSuite } from './eval.js';
import {
  RunIndexSchema,
  ScorecardSchema,
  RunTraceSchema,
  type RunIndex,
  type Scorecard,
  type RunTrace,
} from './result.js';

/**
 * Parse helpers for the Anvil contract.
 *
 * Two flavours per schema:
 *  - `parseX(input)`  — throws a {@link ParseError} with a readable message on failure.
 *  - `safeParseX(input)` — returns Zod's `SafeParseReturnType` for callers that
 *    want to branch without try/catch.
 *
 * YAML helpers parse a string into an object first, then validate.
 */

/** Thrown by the `parseX` helpers; wraps the underlying ZodError for context. */
export class ParseError extends Error {
  public readonly issues: z.ZodIssue[];
  constructor(label: string, error: z.ZodError) {
    super(`${label} failed validation:\n${formatZodError(error)}`);
    this.name = 'ParseError';
    this.issues = error.issues;
  }
}

/** Render a ZodError as an indented, line-per-issue string. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `  - ${path}: ${issue.message}`;
    })
    .join('\n');
}

/**
 * Validate `input` with `schema`, throwing a {@link ParseError} on failure.
 * Each schema is passed in concretely (not via a `z.ZodType<T>` parameter) so
 * the input/output variance of schemas with `.default()`s is preserved.
 */
function ensure<S extends z.ZodTypeAny>(
  schema: S,
  label: string,
  input: unknown,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ParseError(label, result.error);
  }
  return result.data;
}

// --- EvalSuite ---

export function parseEvalSuite(input: unknown): EvalSuite {
  return ensure(EvalSuiteSchema, 'EvalSuite', input);
}
export function safeParseEvalSuite(input: unknown) {
  return EvalSuiteSchema.safeParse(input);
}
/** Parse a YAML string into a validated {@link EvalSuite}. */
export function parseEvalSuiteYaml(yaml: string): EvalSuite {
  return parseEvalSuite(parseYaml(yaml));
}

// --- Scorecard ---

export function parseScorecard(input: unknown): Scorecard {
  return ensure(ScorecardSchema, 'Scorecard', input);
}
export function safeParseScorecard(input: unknown) {
  return ScorecardSchema.safeParse(input);
}

// --- RunIndex ---

export function parseRunIndex(input: unknown): RunIndex {
  return ensure(RunIndexSchema, 'RunIndex', input);
}
export function safeParseRunIndex(input: unknown) {
  return RunIndexSchema.safeParse(input);
}

// --- RunTrace ---

export function parseRunTrace(input: unknown): RunTrace {
  return ensure(RunTraceSchema, 'RunTrace', input);
}
export function safeParseRunTrace(input: unknown) {
  return RunTraceSchema.safeParse(input);
}
