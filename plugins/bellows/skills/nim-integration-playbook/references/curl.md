# Raw HTTP (any language)

The wire format is plain OpenAI chat completions; translate this into any HTTP client.

```bash
curl -s https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen/qwen3-coder-480b-a35b-instruct",
    "messages": [{"role": "user", "content": "Say hello in JSON."}],
    "max_tokens": 256
  }'
```

Response shape (the part that matters): `choices[0].message.content` is the text;
`usage.total_tokens` is the spend.

List models:

```bash
curl -s https://integrate.api.nvidia.com/v1/models -H "Authorization: Bearer $NVIDIA_API_KEY"
```
