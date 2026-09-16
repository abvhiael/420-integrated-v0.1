package storage

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

type securityUploadResolver struct{ sink DeveloperUploadSink }

func (r securityUploadResolver) ResolveUploadSink(string) (DeveloperUploadSink, bool) {
	return r.sink, r.sink != nil
}

type securityBlockingSink struct {
	mu      sync.Mutex
	calls   int
	started chan struct{}
	release chan struct{}
}

func (s *securityBlockingSink) StorePreparedUpload(ctx context.Context, _ DeveloperUploadPlan, _ interface{ Read([]byte) (int, error) }) error {
	panic("unreachable")
}

// securityBlockingUploadSink keeps the io.Reader signature explicit while
// exposing deterministic synchronization for concurrent replay qualification.
type securityBlockingUploadSink struct {
	mu      sync.Mutex
	calls   int
	started chan struct{}
	release chan struct{}
}

func (s *securityBlockingUploadSink) StorePreparedUpload(ctx context.Context, _ DeveloperUploadPlan, _ io.Reader) error {
	s.mu.Lock()
	s.calls++
	first := s.calls == 1
	s.mu.Unlock()
	if first {
		close(s.started)
	}
	select {
	case <-s.release:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (s *securityBlockingUploadSink) Calls() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls
}

func TestProductionUploadConcurrentReplayIsSingleFlight(t *testing.T) {
	payload := []byte("security")
	root := DeveloperShardRoot(payload)
	plan := DeveloperUploadPlan{
		Version: DeveloperAPIVersion,
		UploadID: "upload-1",
		Object: DeveloperObjectRef{ObjectID: "object-1", ManifestID: "manifest-1", ShardIndex: 0, ShardRoot: root, SizeBytes: uint64(len(payload)), CommitmentID: "commitment-1"},
		IdempotencyKey: "idem-1",
		ProviderID: "provider-a", NodeID: "node-a", ServiceID: "store-a",
	}
	sink := &securityBlockingUploadSink{started: make(chan struct{}), release: make(chan struct{})}
	coordinator := &DeveloperUploadCoordinator{Sinks: securityUploadResolver{sink: sink}}

	firstDone := make(chan error, 1)
	go func() {
		_, err := coordinator.Ingest(context.Background(), plan, bytes.NewReader(payload))
		firstDone <- err
	}()
	<-sink.started

	if _, err := coordinator.Ingest(context.Background(), plan, bytes.NewReader(payload)); !errors.Is(err, ErrDeveloperUpload) {
		t.Fatalf("expected concurrent replay rejection, got %v", err)
	}
	if got := sink.Calls(); got != 1 {
		t.Fatalf("expected one backend write while first upload is in flight, got %d", got)
	}
	close(sink.release)
	if err := <-firstDone; err != nil {
		t.Fatalf("first upload failed: %v", err)
	}
	if _, err := coordinator.Ingest(context.Background(), plan, bytes.NewReader(payload)); err != nil {
		t.Fatalf("completed replay should return stored receipt: %v", err)
	}
	if got := sink.Calls(); got != 1 {
		t.Fatalf("completed replay caused duplicate backend write: %d", got)
	}
}

func TestProductionUploadRejectsOversizedIdempotencyKey(t *testing.T) {
	payload := []byte("security")
	coordinator := &DeveloperUploadCoordinator{Discovery: productionDiscoveryStub{}}
	_, err := coordinator.Prepare(context.Background(), DeveloperUploadPrepareRequest{
		Object: DeveloperObjectRef{ObjectID: "object-1", ManifestID: "manifest-1", ShardIndex: 0, ShardRoot: DeveloperShardRoot(payload), SizeBytes: uint64(len(payload)), CommitmentID: "commitment-1"},
		IdempotencyKey: strings.Repeat("x", DeveloperUploadMaxIdempotencyKeyBytes+1),
		Preconditions: DeveloperUploadPreconditions{AgreementID: "agreement-1", CapacityReservationID: "capacity-1", CommitmentID: "commitment-1"},
	})
	if !errors.Is(err, ErrDeveloperUpload) {
		t.Fatalf("expected oversized idempotency key rejection, got %v", err)
	}
}

func TestProductionGatewayHostGuardIgnoresForwardedHost(t *testing.T) {
	allowed, err := validateGatewayAllowedHosts([]string{"storage.example"})
	if err != nil {
		t.Fatal(err)
	}
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	guard := gatewayHostGuard(allowed, next)

	spoofed := httptest.NewRequest(http.MethodGet, "https://evil.example/v1/gateway", nil)
	spoofed.Host = "evil.example"
	spoofed.Header.Set("X-Forwarded-Host", "storage.example")
	spoofedRecorder := httptest.NewRecorder()
	guard.ServeHTTP(spoofedRecorder, spoofed)
	if spoofedRecorder.Code != http.StatusMisdirectedRequest {
		t.Fatalf("forwarded host bypassed authority guard: %d", spoofedRecorder.Code)
	}

	legit := httptest.NewRequest(http.MethodGet, "https://storage.example/v1/gateway", nil)
	legit.Host = "storage.example"
	legit.Header.Set("X-Forwarded-Host", "evil.example")
	legitRecorder := httptest.NewRecorder()
	guard.ServeHTTP(legitRecorder, legit)
	if legitRecorder.Code != http.StatusNoContent {
		t.Fatalf("trusted Host was affected by forwarded spoof: %d", legitRecorder.Code)
	}
}

func TestProductionPrivateReadDefaultsDenyWithoutAuthorizer(t *testing.T) {
	payload := []byte("private")
	req := GatewayRequest{
		CacheKey: CacheKey{ObjectID: "object-private", ManifestID: "manifest-private", ShardIndex: 0, ShardRoot: DeveloperShardRoot(payload), SizeBytes: uint64(len(payload))},
		CommitmentID: "commitment-private",
		Access: GatewayAccess{Mode: GatewayAccessPrivate, Subject: "subject", SessionID: "session", Capability: GatewayAccessRead},
	}
	_, err := (GatewayRouter{}).Route(context.Background(), req)
	if !errors.Is(err, ErrGatewayUnauthorized) {
		t.Fatalf("private read did not fail closed: %v", err)
	}
}

func TestProductionDeveloperHTTPRejectsHeaderExhaustionBeforeRouting(t *testing.T) {
	handler := NewDeveloperHTTPHandler(nil)
	handler.Policy.MaxHeaderBytes = 64
	req := httptest.NewRequest(http.MethodGet, DeveloperRetrievePath+"?shard_index=0&size_bytes=1", nil)
	req.Header.Set("X-Abuse", strings.Repeat("a", 128))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusRequestHeaderFieldsTooLarge {
		t.Fatalf("expected header exhaustion rejection, got %d", recorder.Code)
	}
}

func TestProductionAllowedHostPolicyRejectsURLAndWildcardForms(t *testing.T) {
	for _, candidate := range []string{"https://storage.example", "*.storage.example", "storage.example/path", "storage.example evil.example"} {
		if _, err := validateGatewayAllowedHosts([]string{candidate}); err == nil {
			t.Fatalf("unsafe allowed-host form accepted: %q", candidate)
		}
	}
}
