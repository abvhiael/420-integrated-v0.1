package storage

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestGatewayHTTPRetryTransientStatusThenSuccess(t *testing.T) {
	var attempts atomic.Uint32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if attempts.Add(1) < 3 {
			http.Error(w, "temporary", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("abcd"))
	}))
	defer server.Close()

	payload, err := gatewayHTTPGetWithRetry(context.Background(), server.Client(), server.URL, "", 4, GatewayRetryPolicy{
		MaxAttempts:    3,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     2 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}
	if string(payload) != "abcd" || attempts.Load() != 3 {
		t.Fatalf("payload=%q attempts=%d", payload, attempts.Load())
	}
}

func TestGatewayHTTPRetryDoesNotRetryPermanent4xx(t *testing.T) {
	var attempts atomic.Uint32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		http.Error(w, "missing", http.StatusNotFound)
	}))
	defer server.Close()

	_, err := gatewayHTTPGetWithRetry(context.Background(), server.Client(), server.URL, "", 4, GatewayRetryPolicy{
		MaxAttempts:    4,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     time.Millisecond,
	})
	if err == nil || !errors.Is(err, ErrGatewayRoute) {
		t.Fatalf("err=%v", err)
	}
	if attempts.Load() != 1 {
		t.Fatalf("attempts=%d", attempts.Load())
	}
}

func TestGatewayHTTPRetryExhaustionIsBounded(t *testing.T) {
	var attempts atomic.Uint32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		http.Error(w, "temporary", http.StatusBadGateway)
	}))
	defer server.Close()

	_, err := gatewayHTTPGetWithRetry(context.Background(), server.Client(), server.URL, "", 4, GatewayRetryPolicy{
		MaxAttempts:    3,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     time.Millisecond,
	})
	if err == nil || !errors.Is(err, ErrGatewayRoute) {
		t.Fatalf("err=%v", err)
	}
	if attempts.Load() != 3 {
		t.Fatalf("attempts=%d", attempts.Load())
	}
}

func TestGatewayHTTPRetryCancellationInterruptsBackoff(t *testing.T) {
	var attempts atomic.Uint32
	firstAttempt := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if attempts.Add(1) == 1 {
			close(firstAttempt)
		}
		http.Error(w, "temporary", http.StatusServiceUnavailable)
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		_, err := gatewayHTTPGetWithRetry(ctx, server.Client(), server.URL, "", 4, GatewayRetryPolicy{
			MaxAttempts:    5,
			InitialBackoff: time.Second,
			MaxBackoff:     time.Second,
		})
		done <- err
	}()

	select {
	case <-firstAttempt:
		cancel()
	case <-time.After(time.Second):
		t.Fatal("first attempt did not arrive")
	}

	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("err=%v", err)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("retry backoff did not stop after cancellation")
	}
	if attempts.Load() != 1 {
		t.Fatalf("attempts=%d", attempts.Load())
	}
}

func TestGatewayRetryBackoffCapsDeterministically(t *testing.T) {
	policy := GatewayRetryPolicy{MaxAttempts: 8, InitialBackoff: 100 * time.Millisecond, MaxBackoff: 250 * time.Millisecond}.normalized()
	want := []time.Duration{100 * time.Millisecond, 200 * time.Millisecond, 250 * time.Millisecond, 250 * time.Millisecond}
	for i, expected := range want {
		if got := gatewayRetryBackoff(policy, uint32(i+1)); got != expected {
			t.Fatalf("attempt=%d backoff=%s want=%s", i+1, got, expected)
		}
	}
}
