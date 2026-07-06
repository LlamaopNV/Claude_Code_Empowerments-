import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyReasoningField, classifyToolSupport, probeModel } from './probe.mjs';

test('classifyReasoningField', () => {
  assert.equal(classifyReasoningField({ content: 'hi', reasoning: 'because' }), 'reasoning_content');
  assert.equal(classifyReasoningField({ content: '<think>hm</think>hi', reasoning: '' }), 'inline_think');
  assert.equal(classifyReasoningField({ content: 'hi', reasoning: '' }), 'none');
});

test('classifyToolSupport', () => {
  assert.equal(classifyToolSupport({ toolCalls: [{ id: 'x', name: 'get_time', arguments: '{}' }], content: '' }), 'native');
  assert.equal(classifyToolSupport({ toolCalls: [{ id: 'x', name: 'get_time', arguments: '{oops' }], content: '' }), 'none');
  assert.equal(classifyToolSupport({ toolCalls: [], content: 'I will call {"name": "get_time"} now' }), 'json_imitation');
  assert.equal(classifyToolSupport({ toolCalls: [], content: 'It is noon.' }), 'none');
});

// Scripted chat: answers each benchChat call in order, recording requests.
function scriptedChat(replies) {
  const calls = [];
  const impl = async (req) => {
    calls.push(req);
    const r = replies.shift();
    if (r instanceof Error) throw r;
    return { content: '', reasoning: '', toolCalls: [], finishReason: 'stop', usage: { prompt_tokens: 1, completion_tokens: 500 }, latencyMs: 1, httpStatus: 200, ...r };
  };
  return { impl, calls };
}

test('probeModel assembles a config for a plain non-reasoning model', async () => {
  const { impl, calls } = scriptedChat([
    { content: 'PROBE_OK' },                                     // echo
    { content: 'hello BLUE' },                                   // system
    { content: '```python\ncode\n```', finishReason: 'stop' },   // long output
    { content: 'It is noon.' },                                  // tools → none
    { content: '```python\ndef add(a, b):\n    return a + b\n```' }, // fence
  ]);
  const { config, report } = await probeModel('meta/llama-3.3-70b-instruct', { chatImpl: impl });
  assert.equal(config.reasoning_field, 'none');
  assert.equal(config.temperature, 0);
  assert.equal(config.tool_support, 'none');
  assert.equal(report.excluded, false);
  assert.equal(report.probes.fence, 'pass');
  assert.equal(report.probes.toggle, 'skip');
  assert.equal(calls.length, 5);
});

test('probeModel marks a model excluded when the echo probe errors', async () => {
  const { impl } = scriptedChat([new Error('boom 404')]);
  const { report } = await probeModel('dead/model', { chatImpl: impl });
  assert.equal(report.excluded, true);
  assert.match(report.probes.echo, /^error:/);
  assert.equal(report.probes.system, 'skip');
  assert.equal(report.probes.tools, 'skip');
  assert.equal(report.probes.fence, 'skip');
});

test('probeModel detects reasoning models and native tools', async () => {
  const { impl } = scriptedChat([
    { content: 'PROBE_OK', reasoning: 'let me think' },
    { content: 'hi BLUE' },
    { content: '```python\nx\n```', finishReason: 'stop' },
    { toolCalls: [{ id: 't', name: 'get_time', arguments: '{}' }], finishReason: 'tool_calls' },
    { content: '```python\ndef add(a, b):\n    return a + b\n```' },
  ]);
  const { config } = await probeModel('deepseek-ai/deepseek-v4-pro', { chatImpl: impl });
  assert.equal(config.reasoning_field, 'reasoning_content');
  assert.equal(config.temperature, 0.6);
  assert.equal(config.max_tokens, 32768);
  assert.equal(config.tool_support, 'native');
});

test('probeModel applies a documented reasoning toggle when it changes reasoning presence', async () => {
  const { impl, calls } = scriptedChat([
    { content: 'PROBE_OK' },                                          // echo: no reasoning
    { content: 'hi BLUE' },                                           // system
    { content: '```python\nx\n```', finishReason: 'stop' },           // long output
    { content: 'It is noon.' },                                       // tools -> none
    { content: '```python\ndef add(a, b):\n    return a + b\n```' },  // fence
    { content: '<think>hm</think>PROBE_OK' },                         // toggled echo: inline think appears
  ]);
  const { config, report } = await probeModel('nvidia/llama-3.3-nemotron-super-49b-v1.5', { chatImpl: impl });
  assert.equal(report.probes.toggle, 'pass');
  assert.equal(config.reasoning_toggle, 'detailed thinking on');
  assert.equal(config.reasoning_field, 'inline_think');
  assert.equal(config.temperature, 0.6);
  assert.equal(calls.length, 6);
  assert.equal(calls[5].messages[0].role, 'system');
});
