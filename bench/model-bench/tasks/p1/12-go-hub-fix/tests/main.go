package main

import (
	"fmt"
	"os"
	"runtime"
	"sync"
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

	// fan-out delivery + Sent
	{
		h := NewHub()
		a := h.Subscribe()
		b := h.Subscribe()
		var wg sync.WaitGroup
		var sumA, sumB int
		wg.Add(2)
		go func() { defer wg.Done(); for v := range a { sumA += v } }()
		go func() { defer wg.Done(); for v := range b { sumB += v } }()
		h.Publish(1)
		h.Publish(2)
		h.Publish(3)
		sent := h.Sent()
		h.Close()
		wg.Wait()
		check("deliver-to-all", sumA == 6 && sumB == 6)
		check("sent-counts-deliveries", sent == 6)
	}

	// concurrent publishers, exact totals, no races
	{
		h := NewHub()
		ch := h.Subscribe()
		total := 0
		drained := make(chan struct{})
		go func() {
			for v := range ch {
				total += v
			}
			close(drained)
		}()
		var wg sync.WaitGroup
		for i := 0; i < 4; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for j := 0; j < 25; j++ {
					h.Publish(1)
				}
			}()
		}
		wg.Wait()
		sent := h.Sent()
		h.Close()
		<-drained
		check("concurrent-publishers", total == 100 && sent == 100)
	}

	// Subscribe after Close yields a closed channel
	{
		h := NewHub()
		h.Close()
		select {
		case _, ok := <-h.Subscribe():
			check("subscribe-after-close", !ok)
		case <-time.After(time.Second):
			check("subscribe-after-close", false)
		}
	}

	// Publish after Close: immediate no-op, no panic
	{
		h := NewHub()
		h.Close()
		result := make(chan bool, 1)
		go func() {
			defer func() {
				if recover() != nil {
					result <- false
				}
			}()
			h.Publish(9)
			result <- true
		}()
		select {
		case ok := <-result:
			check("publish-after-close-noop", ok && h.Sent() == 0)
		case <-time.After(time.Second):
			check("publish-after-close-noop", false)
		}
	}

	// double Close is a no-op
	{
		h := NewHub()
		_ = h.Subscribe()
		ok := func() (ok bool) {
			defer func() {
				if recover() != nil {
					ok = false
				}
			}()
			h.Close()
			h.Close()
			return true
		}()
		check("close-idempotent", ok)
	}

	// Close unblocks a Publish stuck on a non-receiving subscriber,
	// and nothing leaks
	{
		time.Sleep(200 * time.Millisecond)
		base := runtime.NumGoroutine()
		h := NewHub()
		_ = h.Subscribe() // never receives
		returned := make(chan struct{})
		go func() {
			h.Publish(7)
			close(returned)
		}()
		time.Sleep(100 * time.Millisecond) // let Publish block on the send
		h.Close()
		unblocked := false
		select {
		case <-returned:
			unblocked = true
		case <-time.After(2 * time.Second):
		}
		time.Sleep(200 * time.Millisecond)
		check("close-unblocks-publish", unblocked)
		check("no-goroutine-leak", runtime.NumGoroutine() <= base+1)
	}
}
