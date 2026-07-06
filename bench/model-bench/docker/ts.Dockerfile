# Grading sandbox: Node + a pinned TypeScript compiler. The harness itself has
# zero npm deps; tsc is a grading tool installed at image build time (network
# is available during build, never during grading).
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd
RUN npm install -g typescript@5.9.2 && adduser -D runner
USER runner
WORKDIR /work
