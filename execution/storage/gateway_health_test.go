package storage

import (
	"context"
	"io"
	"net/http"
	"testing"
	"time"
)

func TestGatewayHealthDegradesAndRecovers(t *testing.T) {
	health := NewGatewayHealthTracker(2)
	if snapshot := health.Snapshot(); !snapshot.Ready || snapshot.Degraded {
		t.Fatalf("initial snapshot = %+v", snapshot)
	}

	health.ObserveGatewayHTTP(context.Background(), GatewayHTTPObservation{StatusCode: http.StatusBadGateway})
	if snapshot := health.Snapshot(); !snapshot.Ready || snapshot.Degraded || snapshot.ConsecutiveFailures != 1 {
		t.Fatalf("after first failure = %+v", snapshot)
	}

	health.ObserveGatewayHTTP(context.Background(), GatewayHTTPObservation{StatusCode: http.StatusGatewayTimeout})
	if snapshot := health.Snapshot(); snapshot.Ready || !snapshot.Degraded || snapshot.ConsecutiveFailures != 2 {
		t.Fatalf("after threshold = %+v", snapshot)
	}

	health.ObserveGatewayHTTP(context.Background(), GatewayHTTPObservation{StatusCode: http.StatusOK, Tier: "cache"})
	snapshot := health.Snapshot()
	if !snapshot.Ready || snapshot.Degraded || snapshot.ConsecutiveFailures != 0 || snapshot.LastTier != "cache" || snapshot.LastSuccess.IsZero() {
		t.Fatalf("after recovery = %+v", snapshot)
	}
}

func TestGatewayHealthEndpointsAndMetricsIsolation(t *testing.T) {
	health := NewGatewayHealthTracker(2)
	service, metrics, _, err := NewGatewayHTTPServiceWithHealthObservability(
		"127.0.0.1:0",
		GatewayHTTPHandler{},
		GatewayHTTPPolicy{MaxConcurrentRequests: 8, RateLimitRequests: 100, RateLimitWindow: time.Minute},
		GatewayHTTPTransportPolicy{AllowedHosts: []string{"gateway.example"}},
		health,
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go service.Run(ctx)
	base := "http://" + service.Addr().String()

	for _, path := range []string{"/healthz", "/readyz"} {
		req, err := http.NewRequest(http.MethodGet, base+path, nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Host = "gateway.example"
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("%s status = %d", path, resp.StatusCode)
		}
		if got := resp.Header.Get("Cache-Control"); got != "no-store" {
			t.Fatalf("%s cache-control = %q", path, got)
		}
	}
	if snapshot := metrics.Snapshot(); snapshot.Requests != 0 {
		t.Fatalf("health probes polluted gateway metrics: %+v", snapshot)
	}

	req, err := http.NewRequest(http.MethodGet, base+"/healthz", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "evil.example"
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusMisdirectedRequest {
		t.Fatalf("unexpected host status = %d", resp.StatusCode)
	}
}

func TestGatewayReadinessReturns503WhenDegraded(t *testing.T) {
	health := NewGatewayHealthTracker(1)
	health.ObserveGatewayHTTP(context.Background(), GatewayHTTPObservation{StatusCode: http.StatusBadGateway})

	recorder := &gatewayResponseRecorder{header: make(http.Header)}
	req, err := http.NewRequest(http.MethodGet, "http://gateway.example/readyz", nil)
	if err != nil {
		t.Fatal(err)
	}
	gatewayHealthHandler(health, http.NotFoundHandler()).ServeHTTP(recorder, req)
	if recorder.status != http.StatusServiceUnavailable {
		t.Fatalf("readyz status = %d", recorder.status)
	}
}
