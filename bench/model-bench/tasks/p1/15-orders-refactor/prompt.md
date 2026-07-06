Refactor the Python god-function below into testable units. Your reply is
saved as `solution.py`. The end-to-end behavior of `process_orders` must be
preserved EXACTLY (byte-identical output for every input), and the module
must additionally expose the units listed after the code. Standard library
only.

Current code:

```python
def process_orders(text):
    lines = [ln for ln in text.strip().splitlines() if ln.strip()]
    ok_count = 0
    revenue = 0
    report_lines = []
    for ln in lines:
        parts = [p.strip() for p in ln.split(",")]
        errors = []
        if len(parts) != 4:
            report_lines.append(
                f"ORDER {parts[0] if parts and parts[0] else '?'} REJECTED bad-format"
            )
            continue
        oid, qty_s, price_s, tier = parts
        if not oid:
            errors.append("bad-id")
        try:
            qty = int(qty_s)
            if qty <= 0:
                errors.append("bad-qty")
        except ValueError:
            qty = 0
            errors.append("bad-qty")
        try:
            price = int(price_s)
            if price < 0:
                errors.append("bad-price")
        except ValueError:
            price = 0
            errors.append("bad-price")
        if tier not in ("gold", "silver", "none"):
            errors.append("bad-tier")
        if errors:
            report_lines.append(f"ORDER {oid or '?'} REJECTED {'+'.join(sorted(errors))}")
            continue
        subtotal = qty * price
        if tier == "gold":
            discount = subtotal * 10 // 100
        elif tier == "silver":
            discount = subtotal * 5 // 100
        else:
            discount = 0
        total = subtotal - discount
        ok_count += 1
        revenue += total
        report_lines.append(f"ORDER {oid} OK {total}")
    report_lines.append(f"TOTAL {revenue} COUNT {ok_count}")
    return "\n".join(report_lines)
```

Required public API after the refactor (exact names and behavior):

- `parse_order_line(line: str) -> dict` — splits one CSV line into
  `{"id": ..., "qty": ..., "price": ..., "tier": ...}` with each field
  whitespace-stripped but still a string; raises ValueError when the line
  does not have exactly 4 comma-separated fields.
- `validate_order(fields: dict) -> list[str]` — takes that dict and returns
  the SORTED list of error codes from: "bad-id" (empty id), "bad-qty" (not
  an int, or <= 0), "bad-price" (not an int, or < 0), "bad-tier" (not one
  of gold/silver/none). Empty list means valid.
- `apply_discount(subtotal: int, tier: str) -> int` — returns the subtotal
  minus the tier discount (gold 10%, silver 5%, none 0%), where the
  discount amount is floored exactly like `subtotal * pct // 100`.
- `order_total(fields: dict) -> int` — int(qty) * int(price) passed through
  apply_discount for the fields' tier (assumes the fields are valid).
- `process_orders(text: str) -> str` — same signature, same output as the
  original, now composed from the units above.
