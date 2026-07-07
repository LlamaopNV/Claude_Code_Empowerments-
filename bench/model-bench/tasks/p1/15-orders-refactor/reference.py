def parse_order_line(line):
    parts = [p.strip() for p in line.split(",")]
    if len(parts) != 4:
        raise ValueError("bad-format")
    return {"id": parts[0], "qty": parts[1], "price": parts[2], "tier": parts[3]}


def validate_order(fields):
    errors = []
    if not fields["id"]:
        errors.append("bad-id")
    try:
        if int(fields["qty"]) <= 0:
            errors.append("bad-qty")
    except ValueError:
        errors.append("bad-qty")
    try:
        if int(fields["price"]) < 0:
            errors.append("bad-price")
    except ValueError:
        errors.append("bad-price")
    if fields["tier"] not in ("gold", "silver", "none"):
        errors.append("bad-tier")
    return sorted(errors)


_DISCOUNT_PCT = {"gold": 10, "silver": 5, "none": 0}


def apply_discount(subtotal, tier):
    return subtotal - subtotal * _DISCOUNT_PCT[tier] // 100


def order_total(fields):
    return apply_discount(int(fields["qty"]) * int(fields["price"]), fields["tier"])


def process_orders(text):
    report = []
    revenue = 0
    ok_count = 0
    for line in text.strip().splitlines():
        if not line.strip():
            continue
        try:
            fields = parse_order_line(line)
        except ValueError:
            first = line.split(",")[0].strip()
            report.append(f"ORDER {first or '?'} REJECTED bad-format")
            continue
        errors = validate_order(fields)
        if errors:
            report.append(f"ORDER {fields['id'] or '?'} REJECTED {'+'.join(errors)}")
            continue
        total = order_total(fields)
        ok_count += 1
        revenue += total
        report.append(f"ORDER {fields['id']} OK {total}")
    report.append(f"TOTAL {revenue} COUNT {ok_count}")
    return "\n".join(report)
