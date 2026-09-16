package storage

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestGatewayHTTPMetricsObserveSafeDimensions(t *testing.T) {
	metrics := &GatewayHTTPMetrics{}
	var observed GatewayHTTPObservation
	capture := GatewayHTTPObserverFunc(func(_ context.Context, observation GatewayHTTPObservation) {
		observed = observation
	})
	h := gatewayObservedHandler([]GatewayHTTPObserver{metrics, capture}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(GatewayHeaderTier, "CACHE")
		w.WriteHeader(http.StatusPartialContent)
		_, _ = w.Write([]byte("abc"))
	}))

	req := httptest.NewRequest(http.MethodGet, "http://gateway.example/v1/gateway?object_id=secret-object", nil)
	req.Header.Set(GatewayHeaderAccessMode, string(GatewayAccessPrivate))
	req.Header.Set(GatewayHeaderSubject, "secret-subject")
	req.Header.Set(GatewayHeaderSessionID, "secret-session")
	req.Header.Set(GatewayHeaderCapability, "secret-capability")
	req.Header.Set("Range", "bytes=0-2")
	req.Header.Set("If-None-Match", `"etag"`)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	snapshot := metrics.Snapshot()
	if snapshot.Requests != 1 || snapshot.Responses2xx != 1 || snapshot.PrivateRequests != 1 || snapshot.RangeRequests != 1 || snapshot.Conditional != 1 || snapshot.ResponseBytes != 3 {
		t.Fatalf("unexpected snapshot: %+v", snapshot)
	}
	if observed.Method != http.MethodGet || observed.AccessMode != GatewayAccessPrivate || observed.StatusCode != http.StatusPartialContent || observed.Tier != "CACHE" || !observed.Ranged || !observed.Conditional || observed.Bytes != 3 || observed.Duration <= 0 {
		t.Fatalf("unexpected observation: %+v", observed)
	}
}

func TestGatewaySlogObserverDoesNotLeakRequestSecrets(t *testing.T) {
	var output bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&output, nil))
	observer := GatewaySlogObserver{Logger: logger}
	h := gatewayObservedHandler([]GatewayHTTPObserver{observer}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(GatewayHeaderTier, "STORE")
		w.WriteHeader(http.StatusForbidden)
	}))

	secrets := []string{"object-secret-420", "subject-secret-420", "session-secret-420", "capability-secret-420", "bearer-secret-420"}
	req := httptest.NewRequest(http.MethodGet, "http://gateway.example/v1/gateway?object_id="+secrets[0], nil)
	req.Header.Set(GatewayHeaderAccessMode, string(GatewayAccessPrivate))
	req.Header.Set(GatewayHeaderSubject, secrets[1])
	req.Header.Set(GatewayHeaderSessionID, secrets[2])
	req.Header.Set(GatewayHeaderCapability, secrets[3])
	req.Header.Set("Authorization", "Bearer "+secrets[4])
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	logged := output.String()
	for _, secret := range secrets {
		if strings.Contains(logged, secret) {
			t.Fatalf("structured log leaked secret %q: %s", secret, logged)
		}
	}
	for _, expected := range []string{`"msg":"420gateway request"`, `"method":"GET"`, `"access_mode":"private"`, `"status":403`, `"tier":"STORE"`} {
		if !strings.Contains(logged, expected) {
			t.Fatalf("missing safe structured field %q in %s", expected, logged)
		}
	}
}

func TestGatewayHTTPMetricsStatusClasses(t *testing.T) {
	metrics := &GatewayHTTPMetrics{}
	for _, status := range []int{http.StatusOK, http.StatusNotModified, http.StatusTooManyRequests, http.StatusBadGateway} {
		metrics.ObserveGatewayHTTP(context.Background(), GatewayHTTPObservation{StatusCode: status, AccessMode: GatewayAccessPublic, Duration: time.Millisecond})
	}
	snapshot := metrics.Snapshot()
	if snapshot.Requests != 4 || snapshot.Responses2xx != 1 || snapshot.Responses3xx != 1 || snapshot.Responses4xx != 1 || snapshot.Responses5xx != 1 || snapshot.PublicRequests != 4 {
		t.Fatalf("unexpected status counters: %+v", snapshot)
	}
}
