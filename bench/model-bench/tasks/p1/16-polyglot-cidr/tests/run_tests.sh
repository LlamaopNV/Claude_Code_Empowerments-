#!/bin/sh
# Grade both halves. A missing/broken half fails its own cases; the other
# half still earns partial credit (spec rule 9).
GO_OK=1
mkdir -p /tmp/build
cp /work/solution.go /tmp/build/solution.go 2>/dev/null || GO_OK=0
if [ "$GO_OK" = "1" ]; then
  (cd /tmp/build && go build -o /tmp/sol-go solution.go) || GO_OK=0
fi

run_case() {
  name=$1
  input=$2
  expected=$3
  py_out=$(printf '%s\n' "$input" | python3 /work/solution.py 2>/dev/null)
  if [ "$py_out" = "$expected" ]; then echo "CASE py-$name PASS"; else echo "CASE py-$name FAIL"; fi
  if [ "$GO_OK" = "1" ]; then
    go_out=$(printf '%s\n' "$input" | /tmp/sol-go 2>/dev/null)
    if [ "$go_out" = "$expected" ]; then echo "CASE go-$name PASS"; else echo "CASE go-$name FAIL"; fi
  else
    echo "CASE go-$name FAIL"
  fi
}

run_case basic '2
10.0.0.0/8
192.168.1.0/24
3
10.1.2.3
192.168.1.42
8.8.8.8' '10.0.0.0/8
192.168.1.0/24
none'

run_case first-match-wins '2
10.0.0.0/8
10.1.0.0/16
1
10.1.5.5' '10.0.0.0/8'

run_case slash32-exact '1
1.2.3.4/32
2
1.2.3.4
1.2.3.5' '1.2.3.4/32
none'

run_case slash0-matches-all '1
0.0.0.0/0
2
255.255.255.255
0.0.0.0' '0.0.0.0/0
0.0.0.0/0'

run_case host-bits-echoed-verbatim '1
10.1.2.3/8
2
10.200.0.1
11.0.0.1' '10.1.2.3/8
none'

run_case boundaries '1
192.168.1.0/24
3
192.168.1.0
192.168.1.255
192.168.2.0' '192.168.1.0/24
192.168.1.0/24
none'

run_case no-cidrs '0
1
4.4.4.4' 'none'
