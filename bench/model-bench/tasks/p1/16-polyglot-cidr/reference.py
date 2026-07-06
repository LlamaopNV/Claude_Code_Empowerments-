import sys


def parse_ip(s):
    n = 0
    for part in s.split("."):
        n = (n << 8) | int(part)
    return n


def main():
    lines = [ln.strip() for ln in sys.stdin.read().splitlines()]
    i = 0
    n = int(lines[i]); i += 1
    cidrs = []
    for _ in range(n):
        raw = lines[i]; i += 1
        net_s, plen_s = raw.split("/")
        plen = int(plen_s)
        mask = 0 if plen == 0 else (0xFFFFFFFF << (32 - plen)) & 0xFFFFFFFF
        cidrs.append((raw, parse_ip(net_s) & mask, mask))
    m = int(lines[i]); i += 1
    out = []
    for _ in range(m):
        ip = parse_ip(lines[i]); i += 1
        match = "none"
        for raw, net, mask in cidrs:
            if ip & mask == net:
                match = raw
                break
        out.append(match)
    sys.stdout.write("\n".join(out) + ("\n" if out else ""))


main()
