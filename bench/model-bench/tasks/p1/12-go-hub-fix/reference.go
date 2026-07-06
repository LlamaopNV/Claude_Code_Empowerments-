package main

import "sync"

// Hub fans values published on it out to every subscriber (fixed).
type Hub struct {
	mu     sync.Mutex
	subs   []chan int
	sent   int
	done   chan struct{}
	closed bool
	pubs   sync.WaitGroup // in-flight Publish calls; Close waits before closing channels
}

func NewHub() *Hub {
	return &Hub{done: make(chan struct{})}
}

func (h *Hub) Subscribe() <-chan int {
	h.mu.Lock()
	defer h.mu.Unlock()
	ch := make(chan int)
	if h.closed {
		close(ch)
		return ch
	}
	h.subs = append(h.subs, ch)
	return ch
}

func (h *Hub) Publish(v int) {
	h.mu.Lock()
	if h.closed {
		h.mu.Unlock()
		return
	}
	subs := append([]chan int(nil), h.subs...)
	h.pubs.Add(1) // registered under the lock so Close cannot miss us
	h.mu.Unlock()
	defer h.pubs.Done()
	for _, ch := range subs {
		select {
		case ch <- v:
			h.mu.Lock()
			h.sent++
			h.mu.Unlock()
		case <-h.done:
			return // hub closed while we were blocked: abandon delivery
		}
	}
}

func (h *Hub) Close() {
	h.mu.Lock()
	if h.closed {
		h.mu.Unlock()
		return
	}
	h.closed = true
	h.mu.Unlock()
	close(h.done) // unblock every in-flight send
	h.pubs.Wait() // no sender may still touch the channels after this
	h.mu.Lock()
	subs := h.subs
	h.subs = nil
	h.mu.Unlock()
	for _, ch := range subs {
		close(ch)
	}
}

func (h *Hub) Sent() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.sent
}
