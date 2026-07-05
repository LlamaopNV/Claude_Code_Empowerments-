# Python

Install: `pip install openai`

```python
import os
from openai import OpenAI

nim = OpenAI(
    api_key=os.environ["NVIDIA_API_KEY"],
    base_url="https://integrate.api.nvidia.com/v1",
)

completion = nim.chat.completions.create(
    model=os.environ.get("NIM_MODEL", "qwen/qwen3-coder-480b-a35b-instruct"),
    messages=[
        {"role": "system", "content": "You are a concise assistant inside MyApp."},
        {"role": "user", "content": user_input},
    ],
    max_tokens=1024,
)

text = completion.choices[0].message.content
```

Notes:
- `os.environ["NVIDIA_API_KEY"]` raising KeyError at startup is a feature: fail at boot, not
  mid-request.
- For retries: catch `openai.RateLimitError`, sleep ~2s, retry once, then re-raise.
- Async apps: `from openai import AsyncOpenAI` with the same arguments.
