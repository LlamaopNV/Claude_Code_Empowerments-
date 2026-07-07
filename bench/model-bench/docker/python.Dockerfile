# Grading sandbox: stdlib-only Python, non-root, no network at run time
# (enforced by --network none on `docker run`, not here).
# 3.14 is required: task 03 grades PEP 750 t-strings (string.templatelib).
FROM python:3.14-slim@sha256:b877e50bd90de10af8d82c57a022fc2e0dc731c5320d762a27986facfc3355c1
RUN useradd --create-home runner
USER runner
WORKDIR /work
