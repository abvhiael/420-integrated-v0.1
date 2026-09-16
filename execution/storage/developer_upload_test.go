package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"testing"
)

type developerUploadDiscoveryStub struct {
	endpoints []ResourceEndpoint
	err       error
}

func (s developerUploadDiscoveryStub) DiscoverResources(context.Context, ResourceDiscoveryRequest) ([]ResourceEndpoint, error) {
	if s.err != nil {
		return nil, s.err
	}
	return append([]ResourceEndpoint(nil), s.endpoints...), nil
}

type developerUploadSinkStub struct {
	calls   int
	payload []byte
	err     error
}

func (s *developerUploadSinkStub) StorePreparedUpload(_ context.Context, _ DeveloperUploadPlan, r io.Reader) error {
	s.calls++
	if s.err != nil {
		return s.err
	}
	payload, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	s.payload = append([]byte(nil), payload...)
	return nil
}

type developerUploadSinkResolverStub struct {
	sink DeveloperUploadSink
}

func (s developerUploadSinkResolverStub) ResolveUploadSink(serviceID string) (DeveloperUploadSink, bool) {
	if serviceID != "store-a" || s.sink == nil {
		return nil, false
	}
	return s.sink, true
}

func developerUploadRequest(payload []byte) DeveloperUploadPrepareRequest {
	digest := sha256.Sum256(payload)
	return DeveloperUploadPrepareRequest{
		Version: DeveloperAPIVersion,
		Object: DeveloperObjectRef{
			ObjectID:     "object-upload-1",
			ManifestID:   "manifest-upload-1",
			ShardIndex:   0,
			ShardRoot:    hex.EncodeToString(digest[:]),
			SizeBytes:    uint64(len(payload)),
			CommitmentID: "commitment-upload-1",
		},
		IdempotencyKey: "idem-upload-1",
		Preconditions: DeveloperUploadPreconditions{
			AgreementID:           "agreement-1",
			CapacityReservationID: "capacity-1",
			CommitmentID:          "commitment-upload-1",
		},
	}
}

func developerUploadCoordinator(sink DeveloperUploadSink) *DeveloperUploadCoordinator {
	return &DeveloperUploadCoordinator{
		Discovery: developerUploadDiscoveryStub{endpoints: []ResourceEndpoint{{
			ProviderID: "provider-a",
			NodeID:     "node-a",
			ServiceID:  "store-a",
			Capability: ResourceCapabilityStore,
			Priority:   1,
			Endpoint:   "https://store-a.invalid",
			State:      ResourceServiceRunning,
		}}},
		Sinks:    developerUploadSinkResolverStub{sink: sink},
		MaxBytes: 1024,
	}
}

func TestDeveloperUploadPrepareSelectsQualifiedStoreProvider(t *testing.T) {
	payload := []byte("bounded upload")
	coordinator := developerUploadCoordinator(&developerUploadSinkStub{})
	plan, err := coordinator.Prepare(context.Background(), developerUploadRequest(payload))
	if err != nil {
		t.Fatal(err)
	}
	if plan.ProviderID != "provider-a" || plan.NodeID != "node-a" || plan.ServiceID != "store-a" {
		t.Fatalf("unexpected provider selection %#v", plan)
	}
	if plan.UploadID == "" || plan.Object.SizeBytes != uint64(len(payload)) {
		t.Fatalf("invalid plan %#v", plan)
	}
}

func TestDeveloperUploadPrepareRequiresCanonicalPreconditions(t *testing.T) {
	payload := []byte("preconditions")
	coordinator := developerUploadCoordinator(&developerUploadSinkStub{})
	req := developerUploadRequest(payload)
	req.Preconditions.AgreementID = ""
	if _, err := coordinator.Prepare(context.Background(), req); !errors.Is(err, ErrDeveloperUpload) {
		t.Fatalf("expected developer upload error, got %v", err)
	}
}

func TestDeveloperUploadPrepareEnforcesMaximumObjectSize(t *testing.T) {
	payload := bytes.Repeat([]byte("x"), 32)
	coordinator := developerUploadCoordinator(&developerUploadSinkStub{})
	coordinator.MaxBytes = 16
	if _, err := coordinator.Prepare(context.Background(), developerUploadRequest(payload)); !errors.Is(err, ErrDeveloperUpload) {
		t.Fatalf("expected max-size rejection, got %v", err)
	}
}

func TestDeveloperUploadIngestVerifiesBeforeProviderWrite(t *testing.T) {
	payload := []byte("verified before provider")
	sink := &developerUploadSinkStub{}
	coordinator := developerUploadCoordinator(sink)
	plan, err := coordinator.Prepare(context.Background(), developerUploadRequest(payload))
	if err != nil {
		t.Fatal(err)
	}
	receipt, err := coordinator.Ingest(context.Background(), plan, bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	if sink.calls != 1 || string(sink.payload) != string(payload) {
		t.Fatalf("unexpected sink state calls=%d payload=%q", sink.calls, string(sink.payload))
	}
	if receipt.UploadID != plan.UploadID || receipt.ShardRoot != plan.Object.ShardRoot {
		t.Fatalf("unexpected receipt %#v", receipt)
	}
}

func TestDeveloperUploadIngestRejectsSizeMismatchBeforeProviderWrite(t *testing.T) {
	payload := []byte("expected bytes")
	sink := &developerUploadSinkStub{}
	coordinator := developerUploadCoordinator(sink)
	plan, err := coordinator.Prepare(context.Background(), developerUploadRequest(payload))
	if err != nil {
		t.Fatal(err)
	}
	_, err = coordinator.Ingest(context.Background(), plan, bytes.NewReader(append(payload, '!')))
	if !errors.Is(err, ErrDeveloperUpload) {
		t.Fatalf("expected size mismatch, got %v", err)
	}
	if sink.calls != 0 {
		t.Fatalf("provider received invalid upload: %d calls", sink.calls)
	}
}

func TestDeveloperUploadIngestRejectsRootMismatchBeforeProviderWrite(t *testing.T) {
	payload := []byte("expected root")
	sink := &developerUploadSinkStub{}
	coordinator := developerUploadCoordinator(sink)
	req := developerUploadRequest(payload)
	req.Object.ShardRoot = hex.EncodeToString(make([]byte, sha256.Size))
	plan, err := coordinator.Prepare(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	_, err = coordinator.Ingest(context.Background(), plan, bytes.NewReader(payload))
	if !errors.Is(err, ErrDeveloperUpload) {
		t.Fatalf("expected root mismatch, got %v", err)
	}
	if sink.calls != 0 {
		t.Fatalf("provider received integrity-invalid upload: %d calls", sink.calls)
	}
}

func TestDeveloperUploadIngestIsIdempotentAfterSuccess(t *testing.T) {
	payload := []byte("idempotent upload")
	sink := &developerUploadSinkStub{}
	coordinator := developerUploadCoordinator(sink)
	plan, err := coordinator.Prepare(context.Background(), developerUploadRequest(payload))
	if err != nil {
		t.Fatal(err)
	}
	first, err := coordinator.Ingest(context.Background(), plan, bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	second, err := coordinator.Ingest(context.Background(), plan, bytes.NewReader([]byte("ignored replay body")))
	if err != nil {
		t.Fatal(err)
	}
	if sink.calls != 1 || first.UploadID != second.UploadID {
		t.Fatalf("idempotent replay wrote again or changed receipt: calls=%d first=%#v second=%#v", sink.calls, first, second)
	}
}

func TestDeveloperUploadFailedProviderWriteDoesNotCreateReceipt(t *testing.T) {
	payload := []byte("provider failure")
	sink := &developerUploadSinkStub{err: errors.New("provider unavailable")}
	coordinator := developerUploadCoordinator(sink)
	plan, err := coordinator.Prepare(context.Background(), developerUploadRequest(payload))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := coordinator.Ingest(context.Background(), plan, bytes.NewReader(payload)); err == nil {
		t.Fatal("expected provider failure")
	}
	sink.err = nil
	if _, err := coordinator.Ingest(context.Background(), plan, bytes.NewReader(payload)); err != nil {
		t.Fatalf("retry after provider failure should remain possible: %v", err)
	}
	if sink.calls != 2 {
		t.Fatalf("expected failed attempt plus successful retry, got %d calls", sink.calls)
	}
}

func TestDeveloperUploadCancellationPreventsProviderWrite(t *testing.T) {
	payload := []byte("cancelled upload")
	sink := &developerUploadSinkStub{}
	coordinator := developerUploadCoordinator(sink)
	plan, err := coordinator.Prepare(context.Background(), developerUploadRequest(payload))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := coordinator.Ingest(ctx, plan, bytes.NewReader(payload)); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected cancellation, got %v", err)
	}
	if sink.calls != 0 {
		t.Fatalf("provider called after cancellation: %d", sink.calls)
	}
}
