package storage

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGatewayNonLoopbackRequiresTLSAndAllowedHosts(t *testing.T) {
	_, err := NewGatewayHTTPServiceWithTransport("0.0.0.0:0", GatewayHTTPHandler{}, GatewayHTTPPolicy{
		MaxConcurrentRequests: 1,
		RateLimitRequests: 1,
		RateLimitWindow: time.Second,
	}, GatewayHTTPTransportPolicy{})
	if err == nil { t.Fatal("expected non-loopback transport rejection") }
}

func TestGatewayTLSPairRequired(t *testing.T) {
	_, err := NewGatewayHTTPServiceWithTransport("127.0.0.1:0", GatewayHTTPHandler{}, GatewayHTTPPolicy{
		MaxConcurrentRequests: 1,
		RateLimitRequests: 1,
		RateLimitWindow: time.Second,
	}, GatewayHTTPTransportPolicy{TLSCertFile: "cert.pem"})
	if err == nil { t.Fatal("expected incomplete TLS configuration rejection") }
}

func TestGatewayAllowedHostValidation(t *testing.T) {
	if _, err := validateGatewayAllowedHosts([]string{"gateway.example", "api.example:443"}); err != nil {
		t.Fatal(err)
	}
	for _, invalid := range []string{"", "https://gateway.example", "*.example", "bad host"} {
		if _, err := validateGatewayAllowedHosts([]string{invalid}); err == nil {
			t.Fatalf("expected invalid host rejection for %q", invalid)
		}
	}
}

func TestGatewayHostGuardExactMatch(t *testing.T) {
	allowed, err := validateGatewayAllowedHosts([]string{"gateway.example"})
	if err != nil { t.Fatal(err) }
	called := false
	h := gatewayHostGuard(allowed, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "http://gateway.example/v1/gateway", nil)
	req.Host = "gateway.example:443"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent || !called { t.Fatalf("status=%d called=%t", w.Code, called) }

	called = false
	req = httptest.NewRequest(http.MethodGet, "http://evil.example/v1/gateway", nil)
	req.Host = "evil.example"
	w = httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusMisdirectedRequest || called { t.Fatalf("status=%d called=%t", w.Code, called) }
}

func TestGatewayLoopbackMayRemainPlainHTTP(t *testing.T) {
	service, err := NewGatewayHTTPServiceWithTransport("127.0.0.1:0", GatewayHTTPHandler{}, GatewayHTTPPolicy{
		MaxConcurrentRequests: 1,
		RateLimitRequests: 1,
		RateLimitWindow: time.Second,
	}, GatewayHTTPTransportPolicy{})
	if err != nil { t.Fatal(err) }
	_ = service.ln.Close()
}
