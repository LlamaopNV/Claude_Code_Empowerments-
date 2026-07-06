// The one closing convention every Phase-1 prompt uses (spec fairness rule 5).
// It is the counterpart of extract.mjs: the promise "the last fenced block is
// what gets executed" must match what the extractor actually does.
export const UNIVERSAL_CLOSING =
  'Reason as much as you need. End your reply with the complete, final solution ' +
  'in a single fenced code block. The last fenced code block in your reply is ' +
  'what gets executed.';

// Sanctioned deviation from fairness rule 5 for multi-block tasks (task 16):
// the standard line promises "a single fenced code block", which would make a
// compliant model merge both programs into one block and lose a half. The
// wording varies per TASK, never per model (rule 4 intact), and its extraction
// promise matches exactly what extract.mjs does with blockCount 2.
export const TWO_BLOCK_CLOSING =
  'Reason as much as you need. End your reply with the complete, final ' +
  'solutions in exactly two fenced code blocks: the Python program first, ' +
  'then the Go program. The last two fenced code blocks in your reply are ' +
  'what get executed.';

export function buildUserPrompt(taskPrompt, blockCount = 1) {
  const closing = blockCount > 1 ? TWO_BLOCK_CLOSING : UNIVERSAL_CLOSING;
  return `${taskPrompt.trim()}\n\n${closing}\n`;
}
