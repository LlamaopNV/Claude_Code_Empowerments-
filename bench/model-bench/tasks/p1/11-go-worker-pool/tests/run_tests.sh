#!/bin/sh
mkdir -p /tmp/build
cp /work/solution.go /tmp/build/ || exit 0
cp /work/tests/main.go /work/tests/go.mod /tmp/build/
cd /tmp/build || exit 0
out=$(go run -race . 2>&1)
status=$?
printf '%s\n' "$out"
# Only meaningful when the binary actually ran (compile failures print no
# CASE lines and must stay COMPILE_FAIL). Race findings make `go run -race`
# exit non-zero.
if printf '%s' "$out" | grep -q '^CASE '; then
  if [ "$status" -eq 0 ]; then echo "CASE race-detector PASS"; else echo "CASE race-detector FAIL"; fi
fi
