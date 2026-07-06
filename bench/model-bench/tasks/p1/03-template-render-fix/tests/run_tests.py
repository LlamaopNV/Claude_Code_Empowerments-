import sys

sys.path.insert(0, "/work")

try:
    from solution import render, raw
except Exception:
    sys.exit(1)  # zero CASE lines => COMPILE_FAIL


def check(name, fn):
    try:
        ok = bool(fn())
    except Exception:
        ok = False
    print(f"CASE {name} {'PASS' if ok else 'FAIL'}")


name = "<b>"
pi = 3.14159

check("interp-escaped", lambda: render(t"<p>{name}</p>") == "<p>&lt;b&gt;</p>")
check("format-spec-on-value", lambda: render(t"pi={pi:.2f}") == "pi=3.14")
check("raw-not-escaped", lambda: render(t"{raw('<em>ok</em>')}") == "<em>ok</em>")


def case_static_verbatim():
    x = "safe"
    return render(t"<div class=\"box\">{x}</div>") == "<div class=\"box\">safe</div>"


check("static-verbatim", case_static_verbatim)


def case_all_escapes():
    v = "&<>\""
    return render(t"{v}") == "&amp;&lt;&gt;&quot;"


check("all-escape-chars", case_all_escapes)


def case_conversion_then_format():
    v = "hi"
    # f-string semantics: convert first (!r → "'hi'", 4 chars), then apply the
    # spec to the converted string (right-align in 6). Single quotes are not
    # in the escape table, so the expected output is "  'hi'".
    return render(t"{v!r:>6}") == "  'hi'"


check("conversion-then-format", case_conversion_then_format)


def case_multiple_interpolations():
    a, b = "<a>", "<b>"
    return render(t"{a}+{b}") == "&lt;a&gt;+&lt;b&gt;"


check("multiple-interpolations", case_multiple_interpolations)


def case_empty_template():
    return render(t"") == ""


check("empty-template", case_empty_template)


def case_raw_ignores_spec():
    return render(t"{raw('<i>x</i>'):>20}") == "<i>x</i>"


check("raw-ignores-spec", case_raw_ignores_spec)


def case_type_error():
    try:
        render("plain string")
        return False
    except TypeError:
        return True
    except Exception:
        return False


check("type-error", case_type_error)
