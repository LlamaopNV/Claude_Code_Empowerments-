# Streaming

Add `"stream": true` and consume server-sent events; each event's
`choices[0].delta.content` carries a text fragment.

JS:

```ts
const stream = await nim.chat.completions.create({ model, messages, stream: true });
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
```

Python:

```python
stream = nim.chat.completions.create(model=model, messages=messages, stream=True)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

When to stream: any UI where a human watches text arrive, or any generation that can exceed
~10s. When not to: machine-to-machine calls that need the whole payload anyway.

Reasoning models (deepseek-ai/deepseek-r1) may emit thinking traces before the answer;
if the SDK exposes `reasoning_content` separately, hide it from end users by default.
