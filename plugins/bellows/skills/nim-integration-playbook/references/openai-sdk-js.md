# JavaScript / TypeScript

Install: `npm install openai`

```ts
import OpenAI from 'openai';

const nim = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

const completion = await nim.chat.completions.create({
  model: process.env.NIM_MODEL ?? 'qwen/qwen3-coder-480b-a35b-instruct',
  messages: [
    { role: 'system', content: 'You are a concise assistant inside MyApp.' },
    { role: 'user', content: userInput },
  ],
  max_tokens: 1024,
});

const text = completion.choices[0].message.content;
```

Notes:
- Next.js/frontend: this code belongs in a route handler or server action, never client-side.
- Error mapping: `err.status === 401` → key problem; `429` → back off once (e.g. 2s), retry,
  then surface.
- Set `timeout` in the client options (ms) for long generations: `new OpenAI({ ..., timeout: 120_000 })`.
