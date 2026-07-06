# Grading sandbox: stdlib-only Python, non-root, no network at run time
# (enforced by --network none on `docker run`, not here).
FROM python:3.12-slim
RUN useradd --create-home runner
USER runner
WORKDIR /work
