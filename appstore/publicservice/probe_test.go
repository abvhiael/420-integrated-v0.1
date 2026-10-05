package publicservice

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestProbeReady(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/readyz" {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := &http.Client{Timeout: time.Second}
	if !ProbeReady(context.Background(), client, server.URL) {
		t.Fatal("expected ready dependency")
	}
	if ProbeReady(context.Background(), client, "") {
		t.Fatal("empty dependency URL must be unavailable")
	}
}

func TestProbeReadyRejectsNonReadyStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "not ready", http.StatusServiceUnavailable)
	}))
	defer server.Close()

	if ProbeReady(context.Background(), &http.Client{Timeout: time.Second}, server.URL) {
		t.Fatal("503 dependency must be unavailable")
	}
}
