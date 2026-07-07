# Renders PEP 750 t-strings to HTML-safe text (fixed).
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
            value = item.value
            if isinstance(value, Raw):
                parts.append(str(value.value))
                continue
            if item.conversion:
                value = _convert(value, item.conversion)
            parts.append(_escape(format(value, item.format_spec)))
        else:
            parts.append(item)
    return "".join(parts)
