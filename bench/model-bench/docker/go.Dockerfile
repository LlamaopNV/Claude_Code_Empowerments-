# Grading sandbox: Go toolchain, non-root. gcc + musl-dev are required by the
# race detector (tasks 11/12 run `go run -race`, which needs cgo's C linker).
FROM golang:1.25-alpine@sha256:523c3effe300580ed375e43f43b1c9b091b68e935a7c3a92bfcc4e7ed55b18c2
RUN apk add --no-cache gcc musl-dev && adduser -D runner
USER runner
# No -mod flag: graders build both module-based (go.mod staged by the task)
# and file-based (`go build file.go`) programs, and -mod=mod errors outside a
# module. GOPROXY=off guarantees no fetches even without --network none.
ENV GOPROXY=off CGO_ENABLED=1
# Bake warm build caches into the image (under the runner's HOME): each
# grading container starts fresh, and a cold stdlib/-race compile on 1 CPU
# could eat most of the 35 s kill budget.
RUN go build std && go build -race std
WORKDIR /work
