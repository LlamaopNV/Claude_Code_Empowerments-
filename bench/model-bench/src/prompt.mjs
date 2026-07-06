// The one closing convention every Phase-1 prompt uses (spec fairness rule 5).
// It is the counterpart of extract.mjs: the promise "the last fenced block is
// what gets executed" must match what the extractor actually does.
export const UNIVERSAL_CLOSING =
  'Reason as much as you need. End your reply with the complete, final solution ' +
  'in a single fenced code block. The last fenced code block in your reply is ' +
  'what gets executed.';

export function buildUserPrompt(taskPrompt) {
  return `${taskPrompt.trim()}\n\n${UNIVERSAL_CLOSING}\n`;
}
