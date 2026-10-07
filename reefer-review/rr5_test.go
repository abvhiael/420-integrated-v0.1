package reeferreview

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"path/filepath"
	"sync"
	"testing"
	"time"

	storage420 "github.com/420integrated/420-integrated/sdk/storage420"
)

type rr5StoredBlob struct {
	owner  string
	object storage420.ObjectRef
	body   []byte
}

type rr5StorageProvider struct {
	mu       sync.Mutex
	profile  BlobSecurityProfile
	blobs    map[string]rr5StoredBlob
	tamper   bool
	getCalls int
}

func newRR5StorageProvider() *rr5StorageProvider {
	return &rr5StorageProvider{
		profile: BlobSecurityProfile{
			Qualified420Storage: true,
			EncryptedAtRest:     true,
			ExternalKeyCustody:  true,
			OwnerScopedAccess:   true,
			SHA256Integrity:     true,
		},
		blobs: map[string]rr5StoredBlob{},
	}
}

func (p *rr5StorageProvider) SecurityProfile() BlobSecurityProfile { return p.profile }

func (p *rr5StorageProvider) PutPrivate(_ context.Context, owner, digest string, body []byte) (storage420.ObjectRef, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	object := storage420.ObjectRef{
		ObjectID:     "obj-" + digest[:16],
		ManifestID:   "manifest-" + digest[:16],
		ShardRoot:    digest,
		SizeBytes:    uint64(len(body)),
		CommitmentID: "commitment-" + digest[:16],
	}
	p.blobs[object.ObjectID] = rr5StoredBlob{owner: owner, object: object, body: append([]byte(nil), body...)}
	return object, nil
}

func (p *rr5StorageProvider) GetPrivate(_ context.Context, owner string, object storage420.ObjectRef) ([]byte, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.getCalls++
	stored, ok := p.blobs[object.ObjectID]
	if !ok || stored.owner != owner || stored.object != object {
		return nil, ErrUnauthorized
	}
	body := append([]byte(nil), stored.body...)
	if p.tamper && len(body) > 0 {
		body[0] ^= 0xff
	}
	return body, nil
}

type rr5Rights struct {
	mutate func(*RightsProvenance)
}

func (r rr5Rights) Assert(_ context.Context, _ string, digest string) (string, error) {
	return "right-" + digest[:12], nil
}

func (r rr5Rights) AssertProvenance(_ context.Context, req RightsAssertionRequest) (RightsProvenance, error) {
	evidence := RightsProvenance{
		ServiceID:      RightsServiceID,
		SubjectID:      "subject-" + req.PublicationID,
		RightID:        "right-" + req.BodyDigest[:12],
		ClaimID:        "claim-" + req.BodyDigest[:12],
		HolderWallet:   "0x1111111111111111111111111111111111111111",
		EvidenceHash:   "evidence-" + req.BodyDigest,
		ProvenanceHash: "provenance-" + req.BodyDigest,
		BodyDigest:     req.BodyDigest,
		ChainID:        420,
		Network:        "testnet",
		RegistryRef:    "rights-claim-registry",
		RouterRef:      "rights-router",
		BlockNumber:    42,
		BlockHash:      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		VerifiedAt:     time.Now().UTC(),
	}
	if req.Wallet != "" {
		evidence.HolderWallet = req.Wallet
	}
	if r.mutate != nil {
		r.mutate(&evidence)
	}
	return evidence, nil
}

func rr5Service(t *testing.T, path string, provider *rr5StorageProvider, rights Rights) Service {
	t.Helper()
	base := testService()
	base.Blobs = Storage420BlobAdapter{Provider: provider}
	base.Rights = rights
	svc, err := NewDurablePublishingService(base, path)
	if err != nil {
		t.Fatal(err)
	}
	return svc
}

func TestRR5DurablePublicationRestartAndIdempotency(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "reefer-review.json")
	provider := newRR5StorageProvider()
	s := rr5Service(t, path, provider, rr5Rights{})

	req := CreateDraftRequest{
		IdempotencyKey: "durable-1", Title: "Durable", Summary: "summary",
		Body: "persistent body", Visibility: VisibilityPublic,
	}
	draft, err := s.CreateDraft(ctx, "writer.420", req)
	if err != nil {
		t.Fatal(err)
	}
	pub, _, err := s.Publish(ctx, "writer.420", draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if pub.RightsProvenance == nil || pub.RightsProvenance.ServiceID != RightsServiceID {
		t.Fatalf("missing rights provenance: %+v", pub)
	}
	if _, _, err := s.Moderate(ctx, "moderator.420", pub.ID, "HIDE", "review"); err != nil {
		t.Fatal(err)
	}

	restarted := rr5Service(t, path, provider, rr5Rights{})
	rows, total, err := restarted.ListEditorial(ctx, "moderator.420", 0, 20)
	if err != nil || total != 1 || len(rows) != 1 || rows[0].Status != StatusHidden {
		t.Fatalf("durable restart state mismatch: %+v total=%d err=%v", rows, total, err)
	}
	history, err := restarted.ListModerationHistory(ctx, "moderator.420", pub.ID)
	if err != nil || len(history) != 1 || history[0].Reason != "review" {
		t.Fatalf("moderation history lost: %+v err=%v", history, err)
	}

	replay, err := restarted.CreateDraft(ctx, "writer.420", req)
	if err != nil || replay.ID != draft.ID {
		t.Fatalf("durable idempotency replay failed: %+v err=%v", replay, err)
	}
	conflict := req
	conflict.Body = "different body"
	if _, err := restarted.CreateDraft(ctx, "writer.420", conflict); !errors.Is(err, ErrConflict) {
		t.Fatalf("conflicting durable idempotency key accepted: %v", err)
	}
}

func TestRR5PublicReadVerifiesStorageIntegrity(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "reefer-review.json")
	provider := newRR5StorageProvider()
	s := rr5Service(t, path, provider, rr5Rights{})
	draft, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "tamper", Title: "Integrity", Body: "untampered", Visibility: VisibilityPublic,
	})
	pub, _, _ := s.Publish(ctx, "writer.420", draft.ID)
	provider.tamper = true
	if _, _, err := s.GetPublic(ctx, pub.ID); !errors.Is(err, ErrStorageIntegrity) {
		t.Fatalf("tampered storage payload accepted: %v", err)
	}
}

func TestRR5UnauthorizedReadDoesNotFetchPrivateBlob(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "reefer-review.json")
	provider := newRR5StorageProvider()
	s := rr5Service(t, path, provider, rr5Rights{})
	draft, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "private", Title: "Private", Body: "secret", Visibility: VisibilityPrivate,
	})
	pub, _, _ := s.Publish(ctx, "writer.420", draft.ID)
	before := provider.getCalls
	if _, _, err := s.GetForActor(ctx, "other.420", pub.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unauthorized private read result: %v", err)
	}
	if provider.getCalls != before {
		t.Fatalf("private blob fetched before authorization: before=%d after=%d", before, provider.getCalls)
	}
}

func TestRR5RequiresQualifiedStorageSecurity(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reefer-review.json")
	provider := newRR5StorageProvider()
	provider.profile.ExternalKeyCustody = false
	base := testService()
	base.Blobs = Storage420BlobAdapter{Provider: provider}
	base.Rights = rr5Rights{}
	if _, err := NewDurablePublishingService(base, path); !errors.Is(err, ErrStorageSecurity) {
		t.Fatalf("unqualified storage accepted: %v", err)
	}
}

func TestRR5RequiresRightsProvenanceProvider(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reefer-review.json")
	base := testService()
	base.Blobs = Storage420BlobAdapter{Provider: newRR5StorageProvider()}
	base.Rights = DevRights{}
	if _, err := NewDurablePublishingService(base, path); !errors.Is(err, ErrRightsProvenance) {
		t.Fatalf("legacy rights adapter accepted as RR-5 durable dependency: %v", err)
	}
}

func TestRR5RightsProvenanceMismatchFailsClosed(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "reefer-review.json")
	provider := newRR5StorageProvider()
	badRights := rr5Rights{mutate: func(e *RightsProvenance) { e.BodyDigest = "wrong" }}
	s := rr5Service(t, path, provider, badRights)
	draft, err := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "bad-rights", Title: "Rights", Body: "body", Visibility: VisibilityPublic,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.Publish(ctx, "writer.420", draft.ID); !errors.Is(err, ErrRightsProvenance) {
		t.Fatalf("mismatched rights provenance accepted: %v", err)
	}
}

func TestRR5StorageAdapterRejectsProviderRootSubstitution(t *testing.T) {
	provider := newRR5StorageProvider()
	adapter := Storage420BlobAdapter{Provider: provider}
	body := []byte("body")
	sum := sha256.Sum256(body)
	digest := hex.EncodeToString(sum[:])
	providerOverride := &rr5BadRootProvider{rr5StorageProvider: provider}
	adapter.Provider = providerOverride
	if _, err := adapter.PutForOwner(context.Background(), "writer.420", digest, body); !errors.Is(err, ErrStorageIntegrity) {
		t.Fatalf("root substitution accepted: %v", err)
	}
}

type rr5BadRootProvider struct{ *rr5StorageProvider }

func (p *rr5BadRootProvider) PutPrivate(ctx context.Context, owner, digest string, body []byte) (storage420.ObjectRef, error) {
	object, err := p.rr5StorageProvider.PutPrivate(ctx, owner, digest, body)
	if err != nil {
		return storage420.ObjectRef{}, err
	}
	object.ShardRoot = "0000000000000000000000000000000000000000000000000000000000000000"
	return object, nil
}
