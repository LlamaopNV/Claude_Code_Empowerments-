# Grading sandbox for task 16: one container that can run BOTH halves
# (CPython for the Python block, Go toolchain for the Go block).
FROM golang:1.25-alpine@sha256:523c3effe300580ed375e43f43b1c9b091b68e935a7c3a92bfcc4e7ed55b18c2
RUN apk add --no-cache python3 && adduser -D runner
USER runner
ENV GOPROXY=off
# Warm the build cache so per-run `go build` stays far under the 35 s kill.
RUN go build std
WORKDIR /work
