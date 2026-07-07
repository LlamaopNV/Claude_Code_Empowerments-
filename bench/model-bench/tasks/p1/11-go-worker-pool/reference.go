package main

import (
	"context"
	"sync"
)

type Job struct {
	ID  int
	Run func() (int, error)
}

type Result struct {
	ID    int
	Value int
	Err   error
}

func RunPool(ctx context.Context, workers int, jobs <-chan Job) <-chan Result {
	if workers < 1 {
		workers = 1
	}
	results := make(chan Result)
	var wg sync.WaitGroup
	wg.Add(workers)
	for i := 0; i < workers; i++ {
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case job, ok := <-jobs:
					if !ok {
						return
					}
					v, err := job.Run()
					select {
					case results <- Result{ID: job.ID, Value: v, Err: err}:
					case <-ctx.Done():
						return // consumer gone after cancel: discard, exit promptly
					}
				}
			}
		}()
	}
	go func() {
		wg.Wait()
		close(results)
	}()
	return results
}
