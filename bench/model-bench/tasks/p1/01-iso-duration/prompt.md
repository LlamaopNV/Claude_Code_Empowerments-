Write a Python module defining one function:

    parse_duration(s: str) -> float

It converts an ISO-8601 duration string to total seconds.

Rules (follow these exactly — they pin down the ambiguous parts of ISO-8601):

- Format: `P[nY][nM][nW][nD][T[nH][nM][nS]]`, e.g. `P1DT2H3M4.5S`, `PT15M`, `P1W`.
- Conversion factors: 1Y = 365 days, 1M (before the T) = 30 days, 1W = 7 days,
  1D = 86400 s, 1H = 3600 s, 1M (after the T) = 60 s.
- Components must appear in the order above; each may appear at most once.
- A fractional value (e.g. `0.5`) is allowed ONLY in the last (smallest)
  component present. `PT0.5H` is valid; `P0.5DT1H` is invalid.
- Negative values are invalid. `P` alone, `PT` alone, an empty string, a
  missing unit letter (`PT1H30`), or any unknown character are invalid.
- Raise `ValueError` for every invalid input.
- Use only the Python standard library.
