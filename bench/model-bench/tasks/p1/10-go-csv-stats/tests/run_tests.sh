#!/bin/sh
# Stage the solution next to the hidden main and run. Compile errors print no
# CASE lines => COMPILE_FAIL.
mkdir -p /tmp/build
cp /work/solution.go /tmp/build/ || exit 0
cp /work/tests/main.go /work/tests/go.mod /tmp/build/
cd /tmp/build || exit 0
go run . 2>&1
