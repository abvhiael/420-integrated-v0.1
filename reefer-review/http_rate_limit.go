package reeferreview

import (
	"net"
	"net/http"
	"sync"
	"time"
)

type apiPeerBudget struct {
	remaining float64
	updated   time.Time
}
type apiRateLimiter struct {
	mu              sync.Mutex
	peers           map[string]apiPeerBudget
	capacity        float64
	refillPerSecond float64
	maxPeers        int
	now             func() time.Time
}

func newAPIRateLimiter(capacity int, perSecond int, maxPeers int) *apiRateLimiter {
	return &apiRateLimiter{peers: make(map[string]apiPeerBudget), capacity: float64(capacity), refillPerSecond: float64(perSecond), maxPeers: maxPeers, now: time.Now}
}
func (l *apiRateLimiter) allow(peer string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	b, exists := l.peers[peer]
	if !exists {
		if len(l.peers) >= l.maxPeers {
			for key, state := range l.peers {
				if now.Sub(state.updated) > time.Duration(l.capacity/l.refillPerSecond+60)*time.Second {
					delete(l.peers, key)
				}
			}
		}
		if len(l.peers) >= l.maxPeers {
			return false
		}
		b = apiPeerBudget{remaining: l.capacity, updated: now}
	}
	elapsed := now.Sub(b.updated).Seconds()
	if elapsed > 0 {
		b.remaining += elapsed * l.refillPerSecond
		if b.remaining > l.capacity {
			b.remaining = l.capacity
		}
	}
	b.updated = now
	if b.remaining < 1 {
		l.peers[peer] = b
		return false
	}
	b.remaining--
	l.peers[peer] = b
	return true
}
func (l *apiRateLimiter) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil || host == "" {
			host = r.RemoteAddr
		}
		if host == "" {
			host = "unknown"
		}
		if !l.allow(host) {
			w.Header().Set("Retry-After", "1")
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "RATE_LIMITED"})
			return
		}
		next.ServeHTTP(w, r)
	})
}
