# Grading sandbox: rustc only (no cargo project; tasks compile a single file).
FROM rust:1.90-alpine@sha256:b4b54b176a74db7e5c68fdfe6029be39a02ccbcfe72b6e5a3e18e2c61b57ae26
RUN adduser -D runner
USER runner
WORKDIR /work
