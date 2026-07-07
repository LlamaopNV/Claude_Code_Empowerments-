// Spec rule 6: strip reasoning first, then take the LAST fenced code block(s);
// if no fence but the reply parses as source, use the raw reply; else the
// sample is EXTRACTION_FAIL. Every decision is returned so callers can log it.
//
// blockCount > 1 (task.json "blocks", polyglot tasks): take the last N blocks
// in reply order. Raw fallback is only defined for blockCount 1 — an unfenced
// reply cannot be split into per-language halves.

// Fences of 3 or 4 backticks; a block closes only on the same-length run, so
// a 4-backtick fence can wrap 3-backtick content (deferred Plan-1 finding).
const FENCE_RE = /(`{3,4})[^\n]*\r?\n([\s\S]*?)\1/g;

// Raw-fallback gate. Single-token homographs (let/var/class/package) open
// English prose sentences ("let me explain…"), so those keywords only count
// when the rest of the line is shaped like code (deferred Plan-1 finding).
const SOURCE_HINT = new RegExp(
  '(^|\\n)\\s*(' +
    'def \\w|class \\w+\\s*[:({]|function[\\s(]|const [\\w$[{]|' +
    'let [\\w$[{][^\\n]*=|var [\\w$[{][^\\n]*=|' +
    'import |from \\S+ import |package [a-z_][\\w./]*\\s*(;|\\r?\\n|$)|' +
    'fn \\w|#include|SELECT |CREATE |WITH )',
);

export function stripReasoning(text, reasoningField) {
  if (reasoningField !== 'inline_think') return text;
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '');
}

export function extractSolution(text, reasoningField, { blockCount = 1 } = {}) {
  const cleaned = stripReasoning(text ?? '', reasoningField);
  const blocks = [...cleaned.matchAll(FENCE_RE)].map((m) => m[2]);
  if (blocks.length) {
    const codes = blocks.slice(-blockCount);
    return { code: codes[codes.length - 1], codes, decision: 'last_fence', fenceCount: blocks.length };
  }
  if (blockCount === 1) {
    const trimmed = cleaned.trim();
    if (trimmed && SOURCE_HINT.test(trimmed)) {
      return { code: trimmed, codes: [trimmed], decision: 'raw_fallback', fenceCount: 0 };
    }
  }
  return { code: null, codes: [], decision: 'none', fenceCount: 0 };
}
