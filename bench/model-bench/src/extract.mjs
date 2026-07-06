// Spec rule 6: strip reasoning first, then take the LAST fenced code block; if
// no fence but the reply parses as source, use the raw reply; else the sample
// is EXTRACTION_FAIL. Every decision is returned so callers can log it.

const SOURCE_HINT =
  /(^|\n)\s*(def |class |function[\s(]|const |let |var |import |from \S+ import |package |fn |#include|SELECT |CREATE )/;

export function stripReasoning(text, reasoningField) {
  if (reasoningField !== 'inline_think') return text;
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '');
}

export function extractSolution(text, reasoningField) {
  const cleaned = stripReasoning(text ?? '', reasoningField);
  const blocks = [...cleaned.matchAll(/```[^\n]*\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (blocks.length) {
    return { code: blocks[blocks.length - 1], decision: 'last_fence', fenceCount: blocks.length };
  }
  const trimmed = cleaned.trim();
  if (trimmed && SOURCE_HINT.test(trimmed)) {
    return { code: trimmed, decision: 'raw_fallback', fenceCount: 0 };
  }
  return { code: null, decision: 'none', fenceCount: 0 };
}
