package mail

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func durableTestService(t *testing.T, path string, blobs *testBlobs) *Service {
	t.Helper()
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	s := NewServiceWithStore(testIDs{"alice.420": true, "bob.420": true}, testPolicy{}, blobs, nil, store)
	s.Now = func() time.Time { return time.Unix(1700000000, 0).UTC() }
	return s
}

func TestDurableStoreRestartRecoveryAndIndexes(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	blobs := &testBlobs{}

	first := durableTestService(t, path, blobs)
	req := SendRequest{IdempotencyKey: "restart", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "durable body", Source: ServiceID}
	msg, err := first.Send(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	archive := FolderArchive
	yes := true
	if _, err := first.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Folder: &archive, Starred: &yes}); err != nil {
		t.Fatal(err)
	}

	restarted := durableTestService(t, path, blobs)
	page, err := restarted.Mailbox(ctx, "bob.420", FolderArchive, "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].Message.ID != msg.ID || !page.Items[0].State.Starred {
		t.Fatalf("restart did not recover indexed mailbox state: %+v", page)
	}
	body, recovered, err := restarted.ReadBody(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "durable body" || recovered.Fingerprint == "" || recovered.IdempotencyKey != "restart" {
		t.Fatalf("restart lost message/private idempotency evidence: %+v", recovered)
	}
	again, err := restarted.Send(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	if again.ID != msg.ID {
		t.Fatalf("restart idempotency changed message id: %s != %s", again.ID, msg.ID)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "durable body") {
		t.Fatal("durable metadata store persisted private message body plaintext")
	}
}

func TestDurableStoreMultiInstanceVisibility(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	blobs := &testBlobs{}
	a := durableTestService(t, path, blobs)
	b := durableTestService(t, path, blobs)

	msg, err := a.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "visible", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	state, err := b.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderInbox {
		t.Fatalf("second instance saw stale state: %+v", state)
	}
	archive := FolderArchive
	if _, err := b.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Folder: &archive}); err != nil {
		t.Fatal(err)
	}
	page, err := a.Mailbox(ctx, "bob.420", FolderArchive, "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].Message.ID != msg.ID {
		t.Fatalf("first instance did not reload second-instance update: %+v", page)
	}
}

func TestDurableStoreDistributedIdempotency(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	blobs := &testBlobs{}
	a := durableTestService(t, path, blobs)
	b := durableTestService(t, path, blobs)
	notify := &testNotify{}
	a.Notify = notify
	b.Notify = notify
	req := SendRequest{IdempotencyKey: "distributed", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "same body", Source: ServiceID}

	start := make(chan struct{})
	results := make(chan Message, 2)
	errs := make(chan error, 2)
	var wg sync.WaitGroup
	for _, svc := range []*Service{a, b} {
		wg.Add(1)
		go func(s *Service) {
			defer wg.Done()
			<-start
			msg, err := s.Send(ctx, "alice.420", req)
			results <- msg
			errs <- err
		}(svc)
	}
	close(start)
	wg.Wait()
	close(results)
	close(errs)

	var ids []string
	for err := range errs {
		if err != nil {
			t.Fatalf("same distributed idempotency request failed: %v", err)
		}
	}
	for msg := range results {
		ids = append(ids, msg.ID)
	}
	if len(ids) != 2 || ids[0] == "" || ids[0] != ids[1] {
		t.Fatalf("distributed idempotency produced different logical messages: %v", ids)
	}
	page, err := a.Inbox(ctx, "bob.420", "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 {
		t.Fatalf("distributed idempotency committed %d inbox messages", len(page.Items))
	}
	if notify.Count() != 1 {
		t.Fatalf("distributed idempotency emitted %d notifications, want 1", notify.Count())
	}
}

func TestDurableStoreDistributedIdempotencyConflict(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	blobs := &testBlobs{}
	a := durableTestService(t, path, blobs)
	b := durableTestService(t, path, blobs)
	base := SendRequest{IdempotencyKey: "conflict", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "one", Source: ServiceID}
	if _, err := a.Send(ctx, "alice.420", base); err != nil {
		t.Fatal(err)
	}
	base.Body = "two"
	if _, err := b.Send(ctx, "alice.420", base); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("second instance accepted conflicting idempotency request: %v", err)
	}
}

func TestDurableStoreTransactionRollback(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	sentinel := errors.New("abort")
	if err := store.Update(ctx, func(data *storeData) error {
		data.Messages["bad"] = Message{ID: "bad"}
		return sentinel
	}); !errors.Is(err, sentinel) {
		t.Fatalf("transaction did not return callback error: %v", err)
	}
	reopened, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := reopened.View(ctx, func(data *storeData) error {
		if _, ok := data.Messages["bad"]; ok {
			t.Fatal("aborted transaction was persisted")
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}

func TestDurableStoreMigratesSchemaZero(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mail-state.json")
	if err := os.WriteFile(path, []byte("{}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.View(context.Background(), func(data *storeData) error {
		if data.SchemaVersion != DurableStoreSchemaVersion {
			t.Fatalf("migration schema=%d", data.SchemaVersion)
		}
		if data.Messages == nil || data.ByIdem == nil || data.Mailbox == nil || data.MailboxIndex == nil {
			t.Fatal("migration did not initialize durable maps/indexes")
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var disk diskStoreData
	if err := json.Unmarshal(raw, &disk); err != nil {
		t.Fatal(err)
	}
	if disk.SchemaVersion != DurableStoreSchemaVersion {
		t.Fatalf("migrated file schema=%d", disk.SchemaVersion)
	}
}

func TestDurableStoreRejectsCorruptAndFutureSchema(t *testing.T) {
	dir := t.TempDir()
	corrupt := filepath.Join(dir, "corrupt.json")
	if err := os.WriteFile(corrupt, []byte("{not-json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := OpenDurableStore(corrupt); !errors.Is(err, ErrStoreCorrupt) {
		t.Fatalf("corrupt store not rejected: %v", err)
	}

	future := filepath.Join(dir, "future.json")
	raw, err := json.Marshal(diskStoreData{SchemaVersion: DurableStoreSchemaVersion + 1})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(future, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := OpenDurableStore(future); !errors.Is(err, ErrStoreSchemaTooNew) {
		t.Fatalf("future schema not rejected: %v", err)
	}
}

func TestDurableStoreRebuildsMailboxIndex(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	msg := Message{
		ID:             "mail_index",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "indexed",
		BodyRef:        "private:bob:ref",
		BodyDigest:     "digest",
		CreatedAt:      time.Unix(1700000000, 0).UTC(),
		UpdatedAt:      time.Unix(1700000000, 0).UTC(),
		Status:         "DELIVERED",
		Visibility:     "PRIVATE",
		Source:         ServiceID,
		Version:        1,
		Fingerprint:    "fingerprint",
		IdempotencyKey: "index",
	}
	state := MailboxState{MessageID: msg.ID, Owner: "bob.420", Folder: FolderInbox, UpdatedAt: msg.UpdatedAt, Version: 1}
	disk := diskStoreData{
		SchemaVersion:   DurableStoreSchemaVersion,
		Messages:        map[string]Message{msg.ID: msg},
		ByIdem:          map[string]string{"alice.420\x00index": msg.ID},
		Mailbox:         map[string]MailboxState{mailboxKey("bob.420", msg.ID): state},
		MailboxIndex:    map[string][]string{"stale": []string{"bad"}},
		Fingerprints:    map[string]string{msg.ID: msg.Fingerprint},
		IdempotencyKeys: map[string]string{msg.ID: msg.IdempotencyKey},
	}
	raw, err := json.Marshal(disk)
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
	svc := NewServiceWithStore(testIDs{"alice.420": true, "bob.420": true}, testPolicy{}, &testBlobs{}, nil, store)
	page, err := svc.Mailbox(ctx, "bob.420", FolderInbox, "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].Message.ID != msg.ID {
		t.Fatalf("rebuilt index did not expose message: %+v", page)
	}
}

func TestDurableStoreFilePermissions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mail-state.json")
	if _, err := OpenDurableStore(path); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{path, path + ".lock"} {
		info, err := os.Stat(p)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != 0o600 {
			t.Fatalf("%s mode=%o want 600", p, got)
		}
	}
}
