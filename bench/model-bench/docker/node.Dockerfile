# Grading sandbox: stdlib-only Node, non-root.
FROM node:22-alpine
RUN adduser -D runner
USER runner
WORKDIR /work
