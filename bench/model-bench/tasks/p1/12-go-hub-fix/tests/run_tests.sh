#!/bin/sh
mkdir -p /tmp/build
cp /work/solution.go /tmp/build/ || exit 0
cp /work/tests/main.go /work/tests/go.mod /tmp/build/
cd /tmp/build || exit 0
out=$(go run -race . 2>&1)
status=$?
printf '%s\n' "$out"
if printf '%s' "$out" | grep -q '^CASE '; then
  if [ "$status" -eq 0 ]; then echo "CASE race-detector PASS"; else echo "CASE race-detector FAIL"; fi
fi
