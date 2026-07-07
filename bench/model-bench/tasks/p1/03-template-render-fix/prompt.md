The Python 3.14 module below renders PEP 750 template strings (t-strings) to
HTML-safe text. Three tests are failing. Fix the module so all three pass
WITHOUT breaking its correct behavior. Reply with the complete fixed module
(it will be saved as `solution.py`; keep the public API: `render`, `raw`,
`Raw`).

Current module:

```python
# Renders PEP 750 t-strings to HTML-safe text.
from string.templatelib import Template, Interpolation

_ESCAPES = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}


class Raw:
    """Wraps an interpolated value so it is inserted without escaping."""

    def __init__(self, value):
        self.value = value


def raw(value):
    return Raw(value)


def _escape(text):
    return "".join(_ESCAPES.get(ch, ch) for ch in text)


def _convert(value, conversion):
    if conversion == "r":
        return repr(value)
    if conversion == "a":
        return ascii(value)
    return str(value)


def render(template):
    if not isinstance(template, Template):
        raise TypeError("render() expects a Template")
    parts = []
    for item in template:
        if isinstance(item, Interpolation):
            text = _convert(item.value, item.conversion)
            if item.format_spec:
                text = format(text, item.format_spec)
            parts.append(text)
        else:
            parts.append(_escape(item))
    return "".join(parts)
```

The three failing tests:

```python
name = "<b>"
assert render(t"<p>{name}</p>") == "<p>&lt;b&gt;</p>"

pi = 3.14159
assert render(t"pi={pi:.2f}") == "pi=3.14"

assert render(t"{raw('<em>ok</em>')}") == "<em>ok</em>"
```

Intended behavior (this is what the hidden tests check):

- Static template text is emitted verbatim, never escaped — markup written in
  the template stays markup.
- Interpolated values ARE escaped (after conversion/formatting) using the
  `&amp; &lt; &gt; &quot;` table.
- A format spec applies to the ORIGINAL value when there is no conversion
  (`{pi:.2f}` formats the float), and to the converted string when a
  conversion is present (matching f-string semantics: convert first, then
  format).
- A `Raw` value is inserted as `str(value.value)` with NO escaping,
  ignoring any conversion or format spec.
- `render` still raises TypeError for non-Template arguments, and an empty
  template renders to `""`.
