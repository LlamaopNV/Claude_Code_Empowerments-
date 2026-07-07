import sys

sys.path.insert(0, "/work")

try:
    from solution import (
        parse_order_line,
        validate_order,
        apply_discount,
        order_total,
        process_orders,
    )
except Exception:
    sys.exit(1)  # zero CASE lines => COMPILE_FAIL


def check(name, fn):
    try:
        ok = bool(fn())
    except Exception:
        ok = False
    print(f"CASE {name} {'PASS' if ok else 'FAIL'}")


check(
    "parse-valid-strips-spaces",
    lambda: parse_order_line(" a1 , 2 , 500 , gold ")
    == {"id": "a1", "qty": "2", "price": "500", "tier": "gold"},
)


def case_parse_bad_format():
    try:
        parse_order_line("a1,2,500")
        return False
    except ValueError:
        return True
    except Exception:
        return False


check("parse-bad-format-raises", case_parse_bad_format)

check("validate-clean", lambda: validate_order({"id": "a", "qty": "2", "price": "10", "tier": "none"}) == [])
check("validate-bad-qty", lambda: validate_order({"id": "a", "qty": "0", "price": "10", "tier": "none"}) == ["bad-qty"]
      and validate_order({"id": "a", "qty": "two", "price": "10", "tier": "none"}) == ["bad-qty"])
check("validate-bad-price", lambda: validate_order({"id": "a", "qty": "1", "price": "-5", "tier": "none"}) == ["bad-price"]
      and validate_order({"id": "a", "qty": "1", "price": "x", "tier": "none"}) == ["bad-price"])
check("validate-bad-tier", lambda: validate_order({"id": "a", "qty": "1", "price": "5", "tier": "vip"}) == ["bad-tier"])
check("validate-bad-id", lambda: validate_order({"id": "", "qty": "1", "price": "5", "tier": "none"}) == ["bad-id"])
check(
    "validate-multiple-sorted",
    lambda: validate_order({"id": "", "qty": "x", "price": "-1", "tier": "vip"})
    == ["bad-id", "bad-price", "bad-qty", "bad-tier"],
)

check("discount-gold-floors", lambda: apply_discount(109, "gold") == 99 and apply_discount(1000, "gold") == 900)
check("discount-silver", lambda: apply_discount(200, "silver") == 190)
check("discount-none", lambda: apply_discount(50, "none") == 50)

check("order-total", lambda: order_total({"id": "b", "qty": "3", "price": "100", "tier": "silver"}) == 285)

E2E_INPUT = (
    "a1,2,500,gold\n"
    "\n"
    " bad-line \n"
    "x,0,100,none\n"
    ",1,100,silver\n"
    "b2,3,100,silver\n"
    "c3,two,abc,vip\n"
)
E2E_EXPECTED = (
    "ORDER a1 OK 900\n"
    "ORDER bad-line REJECTED bad-format\n"
    "ORDER x REJECTED bad-qty\n"
    "ORDER ? REJECTED bad-id\n"
    "ORDER b2 OK 285\n"
    "ORDER c3 REJECTED bad-price+bad-qty+bad-tier\n"
    "TOTAL 1185 COUNT 2"
)

check("end-to-end-identical", lambda: process_orders(E2E_INPUT) == E2E_EXPECTED)
check("end-to-end-empty", lambda: process_orders("") == "TOTAL 0 COUNT 0")
