package storage

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

const defaultGatewayDegradedFailureThreshold uint64 = 3

type GatewayHealthSnapshot struct {
	Ready               bool      `json:"ready"`
	Degraded            bool      `json:"degraded"`
	ConsecutiveFailures uint64    `json:"consecutive_failures"`
	LastSuccess         time.Time `json:"last_success,omitempty"`
	LastFailure         time.Time `json:"last_failure,omitempty"`
	LastTier            string    `json:"last_tier,omitempty"`
}

type GatewayHealthTracker struct {
	mu               sync.RWMutex
	failureThreshold uint64
	snapshot         GatewayHealthSnapshot
}

func NewGatewayHealthTracker(failureThreshold uint64) *GatewayHealthTracker {
	if failureThreshold == 0 {
		failureThreshold = defaultGatewayDegradedFailureThreshold
	}
	return &GatewayHealthTracker{
		failureThreshold: failureThreshold,
		snapshot: GatewayHealthSnapshot{Ready: true},
	}
}

func (h *GatewayHealthTracker) ObserveGatewayHTTP(_ context.Context, observation GatewayHTTPObservation) {
	if h == nil {
		return
	}
	now := time.Now().UTC()
	h.mu.Lock()
	defer h.mu.Unlock()
	if observation.Tier != "" {
		h.snapshot.LastTier = observation.Tier
	}
	if observation.StatusCode >= 500 {
		h.snapshot.ConsecutiveFailures++
		h.snapshot.LastFailure = now
		if h.snapshot.ConsecutiveFailures >= h.failureThreshold {
			h.snapshot.Degraded = true
			h.snapshot.Ready = false
		}
		return
	}
	if observation.StatusCode >= 200 && observation.StatusCode < 500 {
		h.snapshot.ConsecutiveFailures = 0
		h.snapshot.LastSuccess = now
		h.snapshot.Degraded = false
		h.snapshot.Ready = true
	}
}

func (h *GatewayHealthTracker) Snapshot() GatewayHealthSnapshot {
	if h == nil {
		return GatewayHealthSnapshot{}
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.snapshot
}

func gatewayHealthHandler(health *GatewayHealthTracker, next http.Handler) http.Handler {
	if health == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/healthz":
			if r.Method != http.MethodGet && r.Method != http.MethodHead {
				w.Header().Set("Allow", "GET, HEAD")
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "no-store")
			w.WriteHeader(http.StatusOK)
			if r.Method == http.MethodGet {
				_, _ = w.Write([]byte("{\"live\":true}\n"))
			}
			return
		case "/readyz":
			if r.Method != http.MethodGet && r.Method != http.MethodHead {
				w.Header().Set("Allow", "GET, HEAD")
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			snapshot := health.Snapshot()
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "no-store")
			status := http.StatusOK
			if !snapshot.Ready {
				status = http.StatusServiceUnavailable
			}
			w.WriteHeader(status)
			if r.Method == http.MethodGet {
				_ = json.NewEncoder(w).Encode(snapshot)
			}
			return
		default:
			next.ServeHTTP(w, r)
		}
	})
}
