package mail

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDraftCreateAutosaveRecoveryEditDiscard(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	now := time.Unix(1700000000, 0).UTC()
	s.Now = func() time.Time { return now }

	created, err := s.CreateDraft(ctx, "alice.420", DraftCreateRequest{
		AutosaveKey: "compose-window-1",
		Recipient:   "bob.420",
		Subject:     "hello",
		Body:        "private draft body",
		Source:      ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.Draft.ID == "" || created.Draft.Version != 1 || created.Body != "private draft body" {
		t.Fatalf("unexpected created draft: %+v", created)
	}
	if created.Draft.Owner != "alice.420" {
		t.Fatalf("draft owner=%q", created.Draft.Owner)
	}

	replayed, err := s.CreateDraft(ctx, "alice.420", DraftCreateRequest{
		AutosaveKey: "compose-window-1",
		Recipient:   "mallory.420",
		Subject:     "ignored create replay",
		Body:        "different",
		Source:      ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if replayed.Draft.ID != created.Draft.ID || replayed.Draft.Version != 1 || replayed.Body != "private draft body" {
		t.Fatalf("autosave-key replay created/replaced draft: %+v", replayed)
	}

	now = now.Add(time.Minute)
	updated, err := s.SaveDraft(ctx, "alice.420", created.Draft.ID, DraftSaveRequest{
		ExpectedVersion: 1,
		Recipient:       "bob.420",
		Subject:         "hello edited",
		Body:            "edited private draft",
		Source:          ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Draft.Version != 2 || updated.Draft.Subject != "hello edited" || updated.Body != "edited private draft" {
		t.Fatalf("unexpected updated draft: %+v", updated)
	}

	recovered, err := s.GetDraft(ctx, "alice.420", created.Draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if recovered.Draft.Version != 2 || recovered.Body != "edited private draft" {
		t.Fatalf("recovery mismatch: %+v", recovered)
	}
	list, err := s.ListDrafts(ctx, "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != created.Draft.ID || list[0].Version != 2 {
		t.Fatalf("draft list mismatch: %+v", list)
	}

	if err := s.DiscardDraft(ctx, "alice.420", created.Draft.ID, 2); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetDraft(ctx, "alice.420", created.Draft.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("discarded draft recovery error=%v", err)
	}
}

func TestDraftMultiDeviceOptimisticConcurrency(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	created, err := s.CreateDraft(ctx, "alice.420", DraftCreateRequest{
		AutosaveKey: "shared-draft",
		Subject:     "v1",
		Body:        "v1",
		Source:      ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	deviceA, err := s.GetDraft(ctx, "alice.420", created.Draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	deviceB, err := s.GetDraft(ctx, "alice.420", created.Draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if deviceA.Draft.Version != deviceB.Draft.Version {
		t.Fatal("devices did not recover same revision")
	}

	savedA, err := s.SaveDraft(ctx, "alice.420", created.Draft.ID, DraftSaveRequest{
		ExpectedVersion: deviceA.Draft.Version,
		Subject:         "device A",
		Body:            "new body A",
		Source:          ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if savedA.Draft.Version != 2 {
		t.Fatalf("device A version=%d", savedA.Draft.Version)
	}
	if _, err := s.SaveDraft(ctx, "alice.420", created.Draft.ID, DraftSaveRequest{
		ExpectedVersion: deviceB.Draft.Version,
		Subject:         "device B stale",
		Body:            "new body B",
		Source:          ServiceID,
	}); !errors.Is(err, ErrDraftConflict) {
		t.Fatalf("stale device overwrite error=%v", err)
	}
	latest, err := s.GetDraft(ctx, "alice.420", created.Draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if latest.Draft.Subject != "device A" || latest.Body != "new body A" || latest.Draft.Version != 2 {
		t.Fatalf("stale write changed canonical draft: %+v", latest)
	}
	if err := s.DiscardDraft(ctx, "alice.420", created.Draft.ID, 1); !errors.Is(err, ErrDraftConflict) {
		t.Fatalf("stale discard error=%v", err)
	}
}

func TestDraftOwnerIsolationAndInputBounds(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	created, err := s.CreateDraft(ctx, "alice.420", DraftCreateRequest{
		AutosaveKey: "private-draft",
		Body:        "secret",
		Source:      ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetDraft(ctx, "bob.420", created.Draft.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign draft read error=%v", err)
	}
	if _, err := s.SaveDraft(ctx, "bob.420", created.Draft.ID, DraftSaveRequest{
		ExpectedVersion: 1, Body: "steal", Source: ServiceID,
	}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign draft save error=%v", err)
	}
	if err := s.DiscardDraft(ctx, "bob.420", created.Draft.ID, 1); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign draft discard error=%v", err)
	}
	if _, err := s.CreateDraft(ctx, "alice.420", DraftCreateRequest{
		AutosaveKey: strings.Repeat("x", MaxDraftKeyBytes+1), Source: ServiceID,
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("oversized autosave key error=%v", err)
	}
	if _, err := s.CreateDraft(ctx, "alice.420", DraftCreateRequest{
		AutosaveKey: "bad-source", Source: "spoofed/app",
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("spoofed source error=%v", err)
	}
}

func TestDraftOrderingNewestAutosaveFirst(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	now := time.Unix(1700000000, 0).UTC()
	s.Now = func() time.Time { return now }
	first, err := s.CreateDraft(ctx, "alice.420", DraftCreateRequest{AutosaveKey: "a", Body: "a", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(time.Minute)
	second, err := s.CreateDraft(ctx, "alice.420", DraftCreateRequest{AutosaveKey: "b", Body: "b", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	list, err := s.ListDrafts(ctx, "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].ID != second.Draft.ID || list[1].ID != first.Draft.ID {
		t.Fatalf("draft ordering=%+v", list)
	}
}

type failingDeleteBlobs struct{ testBlobs }

func (b *failingDeleteBlobs) DeletePrivate(context.Context, string, string) error {
	return errors.New("delete failed")
}

func TestDraftDiscardFailureRestoresMetadata(t *testing.T) {
	ctx := context.Background()
	blobs := &failingDeleteBlobs{}
	s := NewService(testIDs{"alice.420": true}, testPolicy{}, blobs, nil, NewMemoryStore())
	s.Now = func() time.Time { return time.Unix(1700000000, 0).UTC() }
	created, err := s.CreateDraft(ctx, "alice.420", DraftCreateRequest{AutosaveKey: "rollback", Body: "keep me", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.DiscardDraft(ctx, "alice.420", created.Draft.ID, 1); !errors.Is(err, ErrDraftDeleteUnavailable) {
		t.Fatalf("delete failure error=%v", err)
	}
	recovered, err := s.GetDraft(ctx, "alice.420", created.Draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if recovered.Body != "keep me" || recovered.Draft.Version != 1 {
		t.Fatalf("metadata rollback failed: %+v", recovered)
	}
}

func TestDraftSchemaV6MigrationAndRestartRecovery(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	legacy := diskStoreData{
		SchemaVersion:      6,
		Messages:           map[string]Message{},
		ByIdem:             map[string]string{},
		Mailbox:            map[string]MailboxState{},
		ConversationStates: map[string]ConversationState{},
		ConversationIndex:  map[string][]string{},
		Fingerprints:       map[string]string{},
		IdempotencyKeys:    map[string]string{},
	}
	raw, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.View(ctx, func(data *storeData) error {
		if data.SchemaVersion != DurableStoreSchemaVersion || data.Drafts == nil {
			t.Fatalf("v6->v7 migration incomplete: %+v", data)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	blobs := &testBlobs{}
	s := NewServiceWithStore(testIDs{"alice.420": true}, testPolicy{}, blobs, nil, store)
	s.Now = func() time.Time { return time.Unix(1700000000, 0).UTC() }
	created, err := s.CreateDraft(ctx, "alice.420", DraftCreateRequest{
		AutosaveKey: "restart", Subject: "recover", Body: "encrypted/private draft plaintext", Source: ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	restartedStore, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	restarted := NewServiceWithStore(testIDs{"alice.420": true}, testPolicy{}, blobs, nil, restartedStore)
	recovered, err := restarted.GetDraft(ctx, "alice.420", created.Draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if recovered.Body != "encrypted/private draft plaintext" || recovered.Draft.Version != 1 {
		t.Fatalf("restart recovery=%+v", recovered)
	}
	raw, err = os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "encrypted/private draft plaintext") {
		t.Fatal("durable metadata leaked draft body plaintext")
	}
}
