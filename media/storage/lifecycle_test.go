package storage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"

	storage420 "github.com/420integrated/420-integrated/sdk/storage420"
)

type transportFake struct {
	plan storage420.UploadPlan
	err  error
}

func (f transportFake) Retrieve(context.Context, storage420.RetrieveRequest) (storage420.RetrieveResult, error) {
	return storage420.RetrieveResult{}, nil
}
func (f transportFake) PrepareUpload(_ context.Context, r storage420.UploadPrepareRequest) (storage420.UploadPlan, error) {
	if f.err != nil {
		return storage420.UploadPlan{}, f.err
	}
	p := f.plan
	if p.Version == "" {
		p = storage420.UploadPlan{Version: storage420.APIVersion, UploadID: "upload-1", Object: r.Object, IdempotencyKey: r.IdempotencyKey, Preconditions: r.Preconditions, ProviderID: "provider-1", NodeID: "node-1", ServiceID: "store-1"}
	}
	return p, nil
}
func (f transportFake) Discover(context.Context, storage420.DiscoveryRequest) (storage420.DiscoveryResult, error) {
	return storage420.DiscoveryResult{}, nil
}
func (f transportFake) Status(context.Context) (storage420.ResourceStatus, error) {
	return storage420.ResourceStatus{}, nil
}

type ingestorFake struct {
	receipt UploadReceipt
	err     error
	calls   int
}

func (f *ingestorFake) Ingest(_ context.Context, p storage420.UploadPlan, _ io.Reader) (UploadReceipt, error) {
	f.calls++
	if f.err != nil {
		return UploadReceipt{}, f.err
	}
	if f.receipt.Version == "" {
		return UploadReceipt{Version: storage420.APIVersion, UploadID: p.UploadID, Object: p.Object, ProviderID: p.ProviderID, NodeID: p.NodeID, ServiceID: p.ServiceID, SizeBytes: p.Object.SizeBytes, ShardRoot: p.Object.ShardRoot}, nil
	}
	return f.receipt, nil
}

type manifestFake struct {
	m   storage420.ManifestDescriptor
	err error
}

func (f manifestFake) Manifest(context.Context, string) (storage420.ManifestDescriptor, error) {
	return f.m, f.err
}

type deleterFake struct {
	err   error
	calls int
}

func (f *deleterFake) DeleteMediaAsset(context.Context, Asset) error { f.calls++; return f.err }

func objectFixture() storage420.ObjectRef {
	return storage420.ObjectRef{ObjectID: "object-1", ManifestID: "manifest-1", ShardIndex: 0, ShardRoot: "aaaaaaaa", SizeBytes: 42, CommitmentID: "commitment-1"}
}
func assetFixture() Asset {
	return Asset{ID: "media-1", OwnerRef: "creator-1", MimeType: "video/mp4", Object: objectFixture(), Visibility: VisibilityPrivate, ProvenanceRef: "prov-1", State: StateDraft, Revision: 1}
}
func preFixture() storage420.UploadPreconditions {
	return storage420.UploadPreconditions{AgreementID: "agreement-1", CapacityReservationID: "capacity-1", CommitmentID: "commitment-1"}
}
func manifestFixture() storage420.ManifestDescriptor {
	return storage420.ManifestDescriptor{Version: storage420.APIVersion, ManifestID: "manifest-1", ObjectID: "object-1", ObjectContentRoot: "root", ManifestHash: "hash", EncryptionCommitment: "enc", ErasureRoot: "erasure", ObjectSizeBytes: 42, SegmentCount: 1, DataShards: 1, TotalShards: 1, PlacedShards: 1, SealReady: true, Sealed: true, Retrievable: true, Shards: []storage420.ShardSpec{{ShardIndex: 0, ShardRoot: "aaaaaaaa", SizeBytes: 42, AgreementID: "agreement-1", CommitmentID: "commitment-1", NodeID: "node-1", Live: true}}}
}
func coordinator(ing *ingestorFake, m manifestFake) Coordinator {
	client := storage420.NewClient(transportFake{})
	client.Retry.MaxAttempts = 1
	return Coordinator{Storage: client, Ingestor: ing, Manifests: m}
}

func TestPrepareIngestCanonicalReadyLifecycle(t *testing.T) {
	ing := &ingestorFake{}
	c := coordinator(ing, manifestFake{m: manifestFixture()})
	prepared, plan, err := c.Prepare(context.Background(), assetFixture(), "idem-1", preFixture())
	if err != nil {
		t.Fatal(err)
	}
	if prepared.State != StatePrepared || prepared.Revision != 2 {
		t.Fatalf("prepared=%+v", prepared)
	}
	uploaded, err := c.Ingest(context.Background(), prepared, plan, bytes.NewReader([]byte("payload")))
	if err != nil {
		t.Fatal(err)
	}
	if uploaded.State != StateUploaded || ing.calls != 1 {
		t.Fatalf("uploaded=%+v calls=%d", uploaded, ing.calls)
	}
	ready, err := c.ConfirmCanonical(context.Background(), uploaded)
	if err != nil {
		t.Fatal(err)
	}
	if ready.State != StateReady || ready.Revision != 4 {
		t.Fatalf("ready=%+v", ready)
	}
}

func TestPrepareRejectsStoragePlanSubstitution(t *testing.T) {
	bad := transportFake{plan: storage420.UploadPlan{Version: storage420.APIVersion, UploadID: "upload-x", Object: objectFixture(), IdempotencyKey: "idem-1", Preconditions: preFixture(), ProviderID: "p", NodeID: "n", ServiceID: "s"}}
	bad.plan.Object.ObjectID = "other"
	client := storage420.NewClient(bad)
	client.Retry.MaxAttempts = 1
	c := Coordinator{Storage: client}
	if _, _, err := c.Prepare(context.Background(), assetFixture(), "idem-1", preFixture()); !errors.Is(err, ErrDependencyMismatch) {
		t.Fatalf("got %v", err)
	}
}

func TestIngestFailurePreservesPreparedStateForExactRetry(t *testing.T) {
	ing := &ingestorFake{err: errors.New("provider unavailable")}
	c := coordinator(ing, manifestFake{m: manifestFixture()})
	prepared, plan, err := c.Prepare(context.Background(), assetFixture(), "idem-1", preFixture())
	if err != nil {
		t.Fatal(err)
	}
	got, err := c.Ingest(context.Background(), prepared, plan, bytes.NewReader([]byte("payload")))
	if err == nil || got.State != StatePrepared || got.UploadID != prepared.UploadID {
		t.Fatalf("got=%+v err=%v", got, err)
	}
	ing.err = nil
	got, err = c.Ingest(context.Background(), got, plan, bytes.NewReader([]byte("payload")))
	if err != nil || got.State != StateUploaded || ing.calls != 2 {
		t.Fatalf("retry got=%+v err=%v calls=%d", got, err, ing.calls)
	}
}

func TestCanonicalReadFailurePreservesUploadedStateForRetry(t *testing.T) {
	ing := &ingestorFake{}
	c := coordinator(ing, manifestFake{err: errors.New("rpc down")})
	prepared, plan, _ := c.Prepare(context.Background(), assetFixture(), "idem-1", preFixture())
	uploaded, _ := c.Ingest(context.Background(), prepared, plan, bytes.NewReader([]byte("payload")))
	got, err := c.ConfirmCanonical(context.Background(), uploaded)
	if err == nil || got.State != StateUploaded {
		t.Fatalf("got=%+v err=%v", got, err)
	}
	c.Manifests = manifestFake{m: manifestFixture()}
	got, err = c.ConfirmCanonical(context.Background(), got)
	if err != nil || got.State != StateReady {
		t.Fatalf("retry got=%+v err=%v", got, err)
	}
}

func TestCanonicalManifestMustMatchExactShardAndBeRetrievable(t *testing.T) {
	ing := &ingestorFake{}
	m := manifestFixture()
	m.Retrievable = false
	c := coordinator(ing, manifestFake{m: m})
	prepared, plan, _ := c.Prepare(context.Background(), assetFixture(), "idem-1", preFixture())
	uploaded, _ := c.Ingest(context.Background(), prepared, plan, bytes.NewReader([]byte("payload")))
	if got, err := c.ConfirmCanonical(context.Background(), uploaded); !errors.Is(err, ErrCanonicalNotReady) || got.State != StateUploaded {
		t.Fatalf("got=%+v err=%v", got, err)
	}
	m = manifestFixture()
	m.Shards[0].CommitmentID = "wrong"
	c.Manifests = manifestFake{m: m}
	if _, err := c.ConfirmCanonical(context.Background(), uploaded); !errors.Is(err, ErrDependencyMismatch) {
		t.Fatalf("got %v", err)
	}
}

func TestPrivacyDefaultsFailClosedAndPublicProjectionIsExact(t *testing.T) {
	a := assetFixture()
	a.State = StateReady
	if CanProjectPublic(a) {
		t.Fatal("private asset projected publicly")
	}
	if _, err := ReadAccess(a, "", ""); !errors.Is(err, ErrAccessDenied) {
		t.Fatalf("got %v", err)
	}
	access, err := ReadAccess(a, "creator-1", "session-1")
	if err != nil {
		t.Fatal(err)
	}
	if access.Mode != storage420.AccessPrivate || access.Capability != "read" {
		t.Fatalf("access=%+v", access)
	}
	a.Visibility = VisibilityUnlisted
	if CanProjectPublic(a) {
		t.Fatal("unlisted asset projected publicly")
	}
	access, err = ReadAccess(a, "", "")
	if err != nil || access.Mode != storage420.AccessPublic {
		t.Fatalf("unlisted access=%+v err=%v", access, err)
	}
	a.Visibility = VisibilityPublic
	if !CanProjectPublic(a) {
		t.Fatal("public ready asset not projectable")
	}
}

func TestDerivativeLinkagePreservesOwnerAndProvenanceBoundary(t *testing.T) {
	src := assetFixture()
	src.State = StateReady
	d := assetFixture()
	d.ID = "media-derivative-1"
	d.DerivativeOf = src.ID
	d.Object.ObjectID = "object-2"
	d.ProvenanceRef = "prov-derivative"
	if err := ValidateDerivative(src, d); err != nil {
		t.Fatal(err)
	}
	d.OwnerRef = "other"
	if err := ValidateDerivative(src, d); !errors.Is(err, ErrInvalidAsset) {
		t.Fatalf("got %v", err)
	}
	d.OwnerRef = src.OwnerRef
	d.DerivativeOf = d.ID
	if err := ValidateDerivative(src, d); !errors.Is(err, ErrInvalidAsset) {
		t.Fatalf("self derivative got %v", err)
	}
}

func TestDeleteRequiresCanonicalAwareDeleterAndNeverTombstonesOnFailure(t *testing.T) {
	a := assetFixture()
	a.State = StateReady
	c := Coordinator{}
	got, err := c.Delete(context.Background(), a)
	if !errors.Is(err, ErrDeleteUnsupported) || got.State != StateReady {
		t.Fatalf("got=%+v err=%v", got, err)
	}
	d := &deleterFake{err: errors.New("delete denied")}
	c.Deleter = d
	got, err = c.Delete(context.Background(), a)
	if err == nil || got.State != StateReady || d.calls != 1 {
		t.Fatalf("got=%+v err=%v calls=%d", got, err, d.calls)
	}
	d.err = nil
	got, err = c.Delete(context.Background(), a)
	if err != nil || got.State != StateDeleted || got.Revision != 2 {
		t.Fatalf("got=%+v err=%v", got, err)
	}
	if CanProjectPublic(got) {
		t.Fatal("deleted asset projectable")
	}
}
