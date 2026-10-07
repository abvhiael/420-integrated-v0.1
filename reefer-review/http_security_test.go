package reeferreview

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRR9SecurityHeadersOnPublicAndDeniedResponses(t *testing.T) {
	h := HTTP{Service: testService()}.Handler()
	for _, tc := range []struct{ method, path string }{
		{"GET", "/v1/news"},
		{"POST", "/v1/publications"},
		{"GET", "/invalid-path"},
	} {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		for key, want := range map[string]string{
			"X-Content-Type-Options":       "nosniff",
			"X-Frame-Options":              "DENY",
			"Referrer-Policy":              "no-referrer",
			"Cache-Control":                "no-store",
			"Cross-Origin-Resource-Policy": "same-origin",
		} {
			if got := rr.Header().Get(key); got != want {
				t.Errorf("%s %s %s got %q", tc.method, tc.path, key, got)
			}
		}
		if rr.Header().Get("Content-Security-Policy") == "" {
			t.Fatalf("missing CSP on %s", tc.path)
		}
	}
}

func TestRR9NoImplicitCORSOptIn(t *testing.T) {
	h := HTTP{Service: testService()}.Handler()
	req := httptest.NewRequest(http.MethodOptions, "/v1/publications", nil)
	req.Header.Set("Origin", "https://evil.example")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("unexpected cross-origin access")
	}
}

func TestRR9RateLimitIgnoresSpoofedForwardedHeader(t *testing.T) {
	limiter := newAPIRateLimiter(2, 1, 8)
	now := time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)
	limiter.now = func() time.Time { return now }
	handler := limiter.wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }))
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/v1/news", nil)
		req.RemoteAddr = "192.0.2.2:4321"
		req.Header.Set("X-Forwarded-For", string(rune('a'+i))+".invalid")
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		expected := http.StatusOK
		if i == 2 {
			expected = http.StatusTooManyRequests
		}
		if rr.Code != expected {
			t.Fatalf("request %d status %d expected %d", i, rr.Code, expected)
		}
	}
	now = now.Add(2 * time.Second)
	req := httptest.NewRequest("GET", "/v1/news", nil)
	req.RemoteAddr = "192.0.2.2:4321"
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("refill did not recover: %d", rr.Code)
	}
}
