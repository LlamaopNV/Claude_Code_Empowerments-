The Go file below is a pub/sub hub with concurrency bugs: it has data races,
it leaks goroutines, and closing it can deadlock or panic. Fix it. Your reply
is saved as `solution.go` and compiled with the grader's own main under
`go run -race` — keep `package main`, do NOT add `func main`, keep the
public API (NewHub, Subscribe, Publish, Close, Sent). Standard library only.

Current module:

```go
package main

import "sync"

// Hub fans values published on it out to every subscriber.
type Hub struct {
	mu   sync.Mutex
	subs []chan int
	sent int
	done chan struct{}
}

func NewHub() *Hub {
	return &Hub{done: make(chan struct{})}
}

func (h *Hub) Subscribe() <-chan int {
	ch := make(chan int)
	h.subs = append(h.subs, ch)
	return ch
}

func (h *Hub) Publish(v int) {
	for _, ch := range h.subs {
		go func() {
			ch <- v
			h.sent++
		}()
	}
}

func (h *Hub) Close() {
	close(h.done)
	for _, ch := range h.subs {
		close(ch)
	}
}

func (h *Hub) Sent() int {
	return h.sent
}
```

Intended semantics (the hidden tests check exactly these):

- `Publish(v)` delivers v to every channel subscribed at that moment and
  returns only after each delivery has either been received or been
  abandoned because the hub closed. No goroutine may outlive that decision.
- `Sent()` returns the total number of successful deliveries so far; it and
  every other method are safe to call from multiple goroutines (the race
  detector runs).
- `Close()`: after it returns, every subscriber channel is closed, every
  goroutine the hub started has exited, and later `Publish` calls return
  immediately, delivering nothing, without panicking. A `Publish` blocked
  on a slow/absent receiver must be unblocked by `Close`. Calling `Close`
  again is a no-op. `Subscribe` after `Close` returns an already-closed
  channel.
- Never close a channel that a sender may still be blocked on (no
  send-on-closed-channel panics).
