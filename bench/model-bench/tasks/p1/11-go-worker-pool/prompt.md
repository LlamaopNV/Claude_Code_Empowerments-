Write a Go file (saved as `solution.go`). Declare `package main` but do NOT
define `func main` — the grader compiles your file with its own main and runs
it under the race detector. Standard library only.

Define exactly these types and function:

    type Job struct {
        ID  int
        Run func() (int, error)
    }

    type Result struct {
        ID    int
        Value int
        Err   error
    }

    func RunPool(ctx context.Context, workers int, jobs <-chan Job) <-chan Result

Semantics (follow exactly):

- RunPool returns its results channel immediately and does all work on
  goroutines. It starts exactly `workers` worker goroutines (treat
  workers < 1 as 1). No extra per-job goroutines: at most `workers` jobs may
  ever run concurrently.
- Each worker repeatedly takes a job from `jobs` and calls job.Run(),
  sending Result{ID, Value, Err} (Run's return values, same ID) to the
  results channel. Result order across workers is unspecified.
- When `jobs` is closed and drained, workers exit.
- When ctx is canceled, workers stop taking new jobs. A job already running
  finishes; its result is delivered if the consumer is still receiving, but
  a worker may discard it if delivery would block forever — either way the
  worker must exit promptly.
- After ALL workers have exited, the results channel is closed (the consumer
  can `range` over it).
- No goroutine may leak: shortly after the pool drains or is canceled, every
  goroutine RunPool started must be gone.
- The implementation must be free of data races (graded with -race).
