// Phase 0 — six cheap probes per model, producing configs/<slug>.json plus a
// report row. Spec: models failing probe 1 or 3 are "endpoint issues", not 0s.
import { benchChat } from './client.mjs';
import { extractSolution, stripReasoning } from './extract.mjs';
import { defaultConfig, validateConfig } from './config.mjs';
import { buildUserPrompt } from './prompt.mjs';

export const REASONING_TOGGLES = {
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': 'detailed thinking on',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1': 'detailed thinking on',
};

const PROBE_PARAMS = { temperature: 0.2, top_p: 0.95, max_tokens: 1024 };
const TIME_TOOL = {
  type: 'function',
  function: { name: 'get_time', description: 'Get the current time', parameters: { type: 'object', properties: {}, required: [] } },
};

export function classifyReasoningField({ content, reasoning }) {
  if (reasoning) return 'reasoning_content';
  if (/<think>/.test(content)) return 'inline_think';
  return 'none';
}

export function classifyToolSupport(result) {
  const calls = result.toolCalls ?? [];
  if (calls.length) {
    const allValid = calls.every((c) => {
      try {
        JSON.parse(c.arguments || '{}');
        return true;
      } catch {
        return false;
      }
    });
    if (allValid) return 'native';
    return 'none';
  }
  if (/get_time/.test(result.content) && result.content.includes('{')) return 'json_imitation';
  return 'none';
}

export async function probeModel(model, { chatImpl, env, fetchImpl } = {}) {
  const chat = chatImpl ?? ((req) => benchChat(req, { env, fetchImpl }));
  const ask = (messages, extra = {}) => chat({ model, messages, params: { ...PROBE_PARAMS, ...extra.params }, ...(extra.tools ? { tools: extra.tools } : {}) });
  const probes = { echo: 'skip', system: 'skip', longOutput: 'skip', tools: 'skip', fence: 'skip', toggle: 'skip' };
  const notes = [];
  const obs = {};
  let excluded = false;
  let echoResult = null;

  // 1. echo — hard gate
  try {
    echoResult = await ask([{ role: 'user', content: 'Reply with exactly: PROBE_OK' }]);
    probes.echo = /PROBE_OK/.test(echoResult.content + echoResult.reasoning) ? 'pass' : 'fail';
  } catch (e) {
    probes.echo = `error:${e.message}`;
    excluded = true;
  }
  const reasoningField = echoResult ? classifyReasoningField(echoResult) : 'none';
  obs.reasoning_field = reasoningField;

  // 2. system prompt
  if (!excluded) {
    try {
      const r = await ask([
        { role: 'system', content: 'Always end your reply with the word BLUE.' },
        { role: 'user', content: 'Say hello.' },
      ]);
      obs.systemPromptHonored = /BLUE/i.test(stripReasoning(r.content, reasoningField));
      probes.system = obs.systemPromptHonored ? 'pass' : 'fail';
    } catch (e) {
      probes.system = `error:${e.message}`;
      notes.push('system role rejected by endpoint');
    }
  }

  // 3. long output — hard gate
  if (!excluded) {
    try {
      const r = await ask(
        [{ role: 'user', content: 'Write one Python file containing 40 small, distinct, well-commented utility functions (about 2000 tokens of code). Output only the code in one fenced block.' }],
        { params: { max_tokens: 4096 } },
      );
      const tokens = r.usage?.completion_tokens ?? null;
      const longEnough = tokens !== null ? tokens > 400 : (r.content?.length ?? 0) > 1600;
      obs.longOutput = { finishReason: r.finishReason, completionTokens: tokens };
      probes.longOutput = r.finishReason === 'stop' && longEnough ? 'pass' : 'fail';
      if (tokens === null) notes.push('usage unavailable; long-output judged by content length');
      if (probes.longOutput === 'fail') excluded = true;
    } catch (e) {
      probes.longOutput = `error:${e.message}`;
      excluded = true;
    }
  }

  // 4. tool smoke test
  let toolSupport = 'none';
  if (!excluded) {
    try {
      const r = await ask([{ role: 'user', content: 'What time is it? Use the tool.' }], { tools: [TIME_TOOL] });
      toolSupport = classifyToolSupport(r);
      probes.tools = toolSupport === 'none' ? 'fail' : 'pass';
    } catch (e) {
      probes.tools = `error:${e.message}`;
      if (/tools/i.test(e.message)) notes.push('endpoint rejects tools field');
    }
  }

  // 5. fence discipline
  if (!excluded) {
    try {
      const r = await ask([{ role: 'user', content: buildUserPrompt('Write a Python function add(a, b) that returns their sum.') }]);
      const ex = extractSolution(r.content || r.reasoning, reasoningField);
      obs.fenceDecision = ex.decision;
      probes.fence = ex.decision === 'last_fence' ? 'pass' : 'fail';
    } catch (e) {
      probes.fence = `error:${e.message}`;
    }
  }

  // 6. reasoning toggle (documented models only)
  const toggle = REASONING_TOGGLES[model] ?? null;
  let toggleWorks = false;
  let toggledField = reasoningField;
  if (!excluded && toggle) {
    try {
      const r = await ask([
        { role: 'system', content: toggle },
        { role: 'user', content: 'Reply with exactly: PROBE_OK' },
      ]);
      toggledField = classifyReasoningField(r);
      toggleWorks = (toggledField !== 'none') !== (reasoningField !== 'none');
      probes.toggle = toggleWorks ? 'pass' : 'fail';
    } catch (e) {
      probes.toggle = `error:${e.message}`;
    }
  }

  const effectiveField = toggleWorks ? toggledField : reasoningField;
  const config = defaultConfig(model, { reasoning: effectiveField !== 'none' });
  config.reasoning_field = effectiveField;
  config.tool_support = toolSupport;
  config.reasoning_toggle = toggleWorks ? toggle : null;
  config.probe = { ...obs, probes, notes };
  return { config: validateConfig(config), report: { model, probes, excluded, notes } };
}
