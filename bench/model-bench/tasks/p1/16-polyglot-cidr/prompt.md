Implement the SAME program twice: once in Python 3 (saved as `solution.py`)
and once in Go (saved as `solution.go`, a complete `package main` program).
Reply with exactly two fenced code blocks — the Python program FIRST, the Go
program SECOND (the last two fenced blocks of your reply are executed, in
that order, so the final block must be the Go program). If your reply ends
up containing only ONE fenced block, it is treated as the Go program and the
Python half scores zero.

Both programs read from stdin:

    N                (count of CIDR lines)
    <N lines>        one IPv4 CIDR each, e.g. 10.0.0.0/8
    M                (count of IP lines)
    <M lines>        one IPv4 address each

and print M lines to stdout: for each IP in order, the FIRST CIDR from the
input (echoed exactly as it was written, byte for byte) whose network
contains that IP — or `none` if no CIDR matches.

Rules (follow exactly):

- IPv4 only, dotted-quad, prefix length 0..32. Input is well-formed.
- An address matches a CIDR iff (ip AND mask) == (network AND mask), where
  mask has `prefix` leading one-bits. A /0 matches every address; a /32
  matches exactly one.
- The CIDR's address part may have host bits set (e.g. `10.1.2.3/8`); mask
  it before comparing, but echo the CIDR exactly as written.
- Both the network address and the broadcast address of a block match it.
- Parse addresses manually (integer math). Do NOT use Python's `ipaddress`
  module or Go's `net`/`net/netip` packages. Standard library only
  otherwise; no third-party code.
- Input may or may not end with a trailing newline; both must work.
- The two programs must produce byte-identical output for identical input.
