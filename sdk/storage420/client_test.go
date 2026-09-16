package storage420

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type sdkTransportStub struct {
	retrieve RetrieveResult
	retrieveErrs []error
	retrieveCalls int
	prepare UploadPlan
	discover DiscoveryResult
	status ResourceStatus
}

func (s *sdkTransportStub) Retrieve(context.Context, RetrieveRequest) (RetrieveResult, error) {
	s.retrieveCalls++
	if len(s.retrieveErrs) >= s.retrieveCalls && s.retrieveErrs[s.retrieveCalls-1] != nil { return RetrieveResult{}, s.retrieveErrs[s.retrieveCalls-1] }
	return s.retrieve, nil
}
func (s *sdkTransportStub) PrepareUpload(context.Context, UploadPrepareRequest) (UploadPlan, error) { return s.prepare, nil }
func (s *sdkTransportStub) Discover(context.Context, DiscoveryRequest) (DiscoveryResult, error) { return s.discover, nil }
func (s *sdkTransportStub) Status(context.Context) (ResourceStatus, error) { return s.status, nil }

func TestClientRetriesOnlyRetryableErrors(t *testing.T) {
	stub := &sdkTransportStub{retrieve: RetrieveResult{Version: APIVersion}, retrieveErrs: []error{&Error{Kind: ErrorUnavailable}, nil}}
	client := NewClient(stub)
	client.Retry = RetryPolicy{MaxAttempts: 3, BaseDelay: 0}
	if _, err := client.Retrieve(context.Background(), RetrieveRequest{}); err != nil { t.Fatal(err) }
	if stub.retrieveCalls != 2 { t.Fatalf("calls=%d", stub.retrieveCalls) }

	stub.retrieveCalls = 0
	stub.retrieveErrs = []error{&Error{Kind: ErrorInvalidRequest}}
	if _, err := client.Retrieve(context.Background(), RetrieveRequest{}); err == nil { t.Fatal("expected invalid request error") }
	if stub.retrieveCalls != 1 { t.Fatalf("non-retryable calls=%d", stub.retrieveCalls) }
}

func TestClientCancellationStopsRetry(t *testing.T) {
	stub := &sdkTransportStub{retrieveErrs: []error{&Error{Kind: ErrorUnavailable}, &Error{Kind: ErrorUnavailable}}}
	client := NewClient(stub)
	client.Retry = RetryPolicy{MaxAttempts: 3, BaseDelay: time.Second}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := client.Retrieve(ctx, RetrieveRequest{})
	if !errors.Is(err, context.Canceled) { t.Fatalf("err=%v", err) }
	if stub.retrieveCalls != 0 { t.Fatalf("calls=%d", stub.retrieveCalls) }
}

func TestPrepareUploadRequiresIdempotencyKey(t *testing.T) {
	client := NewClient(&sdkTransportStub{})
	_, err := client.PrepareUpload(context.Background(), UploadPrepareRequest{})
	var typed *Error
	if !errors.As(err, &typed) || typed.Kind != ErrorInvalidRequest { t.Fatalf("err=%v", err) }
}

func TestHTTPTransportRetrievalWireContract(t *testing.T) {
	payload := []byte("sdk-wire")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != retrievePath { t.Fatalf("path=%s", r.URL.Path) }
		if r.Header.Get("X-420-Access-Mode") != "private" || r.Header.Get("X-420-Subject") != "alice" || r.Header.Get("X-420-Session-ID") != "session" || r.Header.Get("X-420-Capability") != "read" { t.Fatalf("headers=%v", r.Header) }
		if r.URL.Query().Get("object_id") != "obj" || r.URL.Query().Get("manifest_id") != "manifest" || r.URL.Query().Get("commitment_id") != "commitment" { t.Fatalf("query=%v", r.URL.Query()) }
		w.Header().Set("X-420-Route-Tier", "cache")
		w.Header().Set("X-420-Provider-ID", "provider")
		w.Header().Set("X-420-Node-ID", "node")
		_, _ = w.Write(payload)
	}))
	defer server.Close()
	transport, err := NewHTTPTransport(server.URL, server.Client())
	if err != nil { t.Fatal(err) }
	result, err := transport.Retrieve(context.Background(), RetrieveRequest{Object: ObjectRef{ObjectID:"obj", ManifestID:"manifest", ShardIndex:2, ShardRoot:"root", SizeBytes:uint64(len(payload)), CommitmentID:"commitment"}, Access: ReadAccess{Mode:AccessPrivate, Subject:"alice", SessionID:"session", Capability:"read"}})
	if err != nil { t.Fatal(err) }
	if string(result.Payload) != string(payload) || result.Route.Tier != "cache" || result.Route.ProviderID != "provider" || result.Route.NodeID != "node" { t.Fatalf("result=%#v", result) }
}

func TestHTTPTransportRequiresTLSForRemoteEndpoints(t *testing.T) {
	if _, err := NewHTTPTransport("http://example.com", nil); err == nil { t.Fatal("expected remote HTTP rejection") }
}

func TestHTTPTransportMapsTypedServerErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"version":"v1","error":"denied","code":"forbidden"}`))
	}))
	defer server.Close()
	transport, err := NewHTTPTransport(server.URL, server.Client())
	if err != nil { t.Fatal(err) }
	_, err = transport.Retrieve(context.Background(), RetrieveRequest{Object:ObjectRef{SizeBytes:1}})
	var typed *Error
	if !errors.As(err, &typed) || typed.Kind != ErrorUnauthorized || typed.Code != "forbidden" { t.Fatalf("err=%#v", err) }
}
