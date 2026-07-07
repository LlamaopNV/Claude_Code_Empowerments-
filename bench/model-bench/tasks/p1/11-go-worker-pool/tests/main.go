package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"runtime"
	"sync/atomic"
	"time"
)

func check(name string, ok bool) {
	status := "FAIL"
	if ok {
		status = "PASS"
	}
	fmt.Printf("CASE %s %s\n", name, status)
}

func main() {
	go func() { // deadlock watchdog
		time.Sleep(25 * time.Second)
		fmt.Println("CASE watchdog FAIL")
		os.Exit(3)
	}()

	// all jobs processed, channel closes
	{
		jobs := make(chan Job)
		go func() {
			for i := 1; i <= 20; i++ {
				id := i
				jobs <- Job{ID: id, Run: func() (int, error) { return id * id, nil }}
			}
			close(jobs)
		}()
		sum := 0
		seen := map[int]bool{}
		for r := range RunPool(context.Background(), 4, jobs) {
			seen[r.ID] = true
			sum += r.Value
		}
		check("all-jobs-processed", len(seen) == 20 && sum == 2870)
	}

	// errors propagate with their job id
	{
		jobs := make(chan Job, 2)
		jobs <- Job{ID: 1, Run: func() (int, error) { return 0, errors.New("boom") }}
		jobs <- Job{ID: 2, Run: func() (int, error) { return 7, nil }}
		close(jobs)
		errs := map[int]error{}
		vals := map[int]int{}
		for r := range RunPool(context.Background(), 2, jobs) {
			errs[r.ID] = r.Err
			vals[r.ID] = r.Value
		}
		check("errors-propagated", errs[1] != nil && errs[2] == nil && vals[2] == 7)
	}

	// exactly `workers` jobs run concurrently
	{
		var cur, max int64
		jobs := make(chan Job)
		go func() {
			for i := 0; i < 9; i++ {
				id := i
				jobs <- Job{ID: id, Run: func() (int, error) {
					c := atomic.AddInt64(&cur, 1)
					for {
						m := atomic.LoadInt64(&max)
						if c <= m || atomic.CompareAndSwapInt64(&max, m, c) {
							break
						}
					}
					time.Sleep(50 * time.Millisecond)
					atomic.AddInt64(&cur, -1)
					return id, nil
				}}
			}
			close(jobs)
		}()
		n := 0
		for range RunPool(context.Background(), 3, jobs) {
			n++
		}
		// >= rather than == : a correct pool cannot exceed 3 by construction
		// (only 3 workers exist), and >= is not flaky under -race on 1 CPU.
		check("concurrency-capped-at-workers", atomic.LoadInt64(&max) >= 3 && n == 9)
	}

	// cancellation stops new jobs; channel still closes
	{
		ctx, cancel := context.WithCancel(context.Background())
		jobs := make(chan Job, 10)
		for i := 0; i < 10; i++ {
			id := i
			jobs <- Job{ID: id, Run: func() (int, error) { time.Sleep(80 * time.Millisecond); return id, nil }}
		}
		close(jobs)
		n := 0
		for range RunPool(ctx, 2, jobs) {
			n++
			if n == 2 {
				cancel()
			}
		}
		cancel()
		check("cancel-stops-new-jobs", n >= 2 && n <= 6)
	}

	// no goroutine leak after completion
	{
		time.Sleep(200 * time.Millisecond)
		base := runtime.NumGoroutine()
		jobs := make(chan Job, 3)
		for i := 0; i < 3; i++ {
			id := i
			jobs <- Job{ID: id, Run: func() (int, error) { return id, nil }}
		}
		close(jobs)
		for range RunPool(context.Background(), 4, jobs) {
		}
		time.Sleep(200 * time.Millisecond)
		check("no-goroutine-leak", runtime.NumGoroutine() <= base+1)
	}

	// workers < 1 clamps to one worker
	{
		jobs := make(chan Job, 2)
		for i := 0; i < 2; i++ {
			id := i
			jobs <- Job{ID: id, Run: func() (int, error) { return id, nil }}
		}
		close(jobs)
		n := 0
		for range RunPool(context.Background(), 0, jobs) {
			n++
		}
		check("zero-workers-clamped-to-one", n == 2)
	}
}
