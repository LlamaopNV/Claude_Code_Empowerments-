#!/bin/sh
# Compile solution + type assertions with strict tsc; a compile error yields
# zero CASE lines => COMPILE_FAIL. Then run the runtime cases against the
# emitted JS.
mkdir -p /tmp/build /tmp/out
cp /work/solution.ts /tmp/build/solution.ts || exit 0
cp /work/tests/typecheck.ts /tmp/build/typecheck.ts
if ! tsc --strict --target es2022 --module es2022 --moduleResolution bundler \
    --outDir /tmp/out /tmp/build/solution.ts /tmp/build/typecheck.ts; then
  exit 0
fi
echo '{"type":"module"}' > /tmp/out/package.json
node /work/tests/run_tests.mjs
