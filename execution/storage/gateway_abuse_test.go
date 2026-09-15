package storage

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestGatewayAbuseGuardRateLimitAndRecovery(t *testing.T) {
	guard, err := newGatewayAbuseGuard(GatewayHTTPPolicy{MaxConcurrentRequests: 2, RateLimitRequests: 2, RateLimitWindow: 40 * time.Millisecond})
	if err != nil { t.Fatal(err) }
	h := guard.wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	request := func() *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodGet, "http://gateway/v1/gateway", nil)
		r.RemoteAddr = "192.0.2.10:12345"
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if got := request().Code; got != http.StatusNoContent { t.Fatalf("first status=%d", got) }
	if got := request().Code; got != http.StatusNoContent { t.Fatalf("second status=%d", got) }
	limited := request()
	if limited.Code != http.StatusTooManyRequests || limited.Header().Get("Retry-After") == "" { t.Fatalf("limited=%d retry=%q", limited.Code, limited.Header().Get("Retry-After")) }
	time.Sleep(55 * time.Millisecond)
	if got := request().Code; got != http.StatusNoContent { t.Fatalf("recovered status=%d", got) }
}

func TestGatewayAbuseGuardSeparatesClientAddresses(t *testing.T) {
	guard, err := newGatewayAbuseGuard(GatewayHTTPPolicy{MaxConcurrentRequests: 2, RateLimitRequests: 1, RateLimitWindow: time.Minute})
	if err != nil { t.Fatal(err) }
	h := guard.wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	for _, addr := range []string{"192.0.2.10:1000", "192.0.2.11:1000"} {
		r := httptest.NewRequest(http.MethodGet, "http://gateway/v1/gateway", nil)
		r.RemoteAddr = addr
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != http.StatusNoContent { t.Fatalf("addr=%s status=%d", addr, w.Code) }
	}
}

func TestGatewayAbuseGuardConcurrencyLimitAndRecovery(t *testing.T) {
	guard, err := newGatewayAbuseGuard(GatewayHTTPPolicy{MaxConcurrentRequests: 1, RateLimitRequests: 100, RateLimitWindow: time.Minute})
	if err != nil { t.Fatal(err) }
	entered := make(chan struct{}, 1)
	release := make(chan struct{})
	h := guard.wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		entered <- struct{}{}
		<-release
		w.WriteHeader(http.StatusNoContent)
	}))
	firstDone := make(chan int, 1)
	go func() {
		r := httptest.NewRequest(http.MethodGet, "http://gateway/v1/gateway", nil)
		r.RemoteAddr = "192.0.2.20:1000"
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		firstDone <- w.Code
	}()
	<-entered
	r := httptest.NewRequest(http.MethodGet, "http://gateway/v1/gateway", nil)
	r.RemoteAddr = "192.0.2.21:1000"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusTooManyRequests { t.Fatalf("saturated status=%d", w.Code) }
	close(release)
	if got := <-firstDone; got != http.StatusNoContent { t.Fatalf("first status=%d", got) }

	var once sync.Once
	h2 := guard.wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { once.Do(func() {}); w.WriteHeader(http.StatusNoContent) }))
	r2 := httptest.NewRequest(http.MethodGet, "http://gateway/v1/gateway", nil)
	r2.RemoteAddr = "192.0.2.22:1000"
	w2 := httptest.NewRecorder()
	h2.ServeHTTP(w2, r2)
	if w2.Code != http.StatusNoContent { t.Fatalf("recovery status=%d", w2.Code) }
}

func TestGatewayHTTPServicePolicyValidation(t *testing.T) {
	_, err := NewGatewayHTTPServiceWithPolicy("127.0.0.1:0", GatewayHTTPHandler{}, GatewayHTTPPolicy{})
	if err == nil { t.Fatal("expected invalid policy") }

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_ = ctx
}
