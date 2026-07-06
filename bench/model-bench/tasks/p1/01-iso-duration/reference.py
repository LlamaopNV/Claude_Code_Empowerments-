import re

_FACTORS = [
    ("Y", 365 * 86400.0, False), ("M", 30 * 86400.0, False), ("W", 7 * 86400.0, False),
    ("D", 86400.0, False), ("H", 3600.0, True), ("M", 60.0, True), ("S", 1.0, True),
]
_NUM = re.compile(r"(\d+(?:\.\d+)?)([A-Z])")


def parse_duration(s: str) -> float:
    if not isinstance(s, str) or not s.startswith("P") or s == "P":
        raise ValueError(s)
    body = s[1:]
    if "T" in body:
        date_part, _, time_part = body.partition("T")
        if time_part == "":
            raise ValueError(s)
    else:
        date_part, time_part = body, ""
    total = 0.0
    idx = 0  # position in _FACTORS; components must advance
    fraction_seen = False
    for part, time_flag in ((date_part, False), (time_part, True)):
        pos = 0
        while pos < len(part):
            m = _NUM.match(part, pos)
            if not m:
                raise ValueError(s)
            value, unit = float(m.group(1)), m.group(2)
            if fraction_seen:
                raise ValueError(s)  # a fraction is only allowed in the last component
            if "." in m.group(1):
                fraction_seen = True
            while idx < len(_FACTORS) and not (_FACTORS[idx][0] == unit and _FACTORS[idx][2] == time_flag):
                idx += 1
            if idx >= len(_FACTORS):
                raise ValueError(s)
            total += value * _FACTORS[idx][1]
            idx += 1
            pos = m.end()
    return total
