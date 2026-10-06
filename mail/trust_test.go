package mail

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestBlockedIdentityRejectsBeforePrivateStorage(t *testing.T) {
	ctx := context.Background()
	blobs := &testBlobs{}
	notify := &testNotify{}
	s := NewService(testIDs{"alice.420": true, "bob.420": true}, testPolicy{}, blobs, notify, NewMemoryStore())
	if _, err := s.PutTrustEntry(ctx, "bob.420", TrustIdentity, "Alice.420", TrustBlock); err != nil {
		t.Fatal(err)
	}
	_, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "blocked-identity", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "private body", Source: ServiceID,
	})
	if !errors.Is(err, ErrTrustRejected) {
		t.Fatalf("blocked identity send error=%v", err)
	}
	if len(blobs.data) != 0 {
		t.Fatalf("blocked delivery wrote private blob: %+v", blobs.data)
	}
	if notify.Count() != 0 {
		t.Fatalf("blocked delivery emitted notification: %d", notify.Count())
	}
	page, err := s.Inbox(ctx, "bob.420", "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 0 {
		t.Fatalf("blocked delivery materialized inbox state: %+v", page)
	}
}

func TestTrustedIdentityBypassesBlockedPhrase(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	if _, err := s.PutTrustEntry(ctx, "bob.420", TrustPhrase, "BANANA", TrustBlock); err != nil {
		t.Fatal(err)
	}
	if _, err := s.PutTrustEntry(ctx, "bob.420", TrustIdentity, "alice.420", TrustAllow); err != nil {
		t.Fatal(err)
	}
	msg, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "trusted-over-phrase", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "contains banana", Source: ServiceID,
	})
	if err != nil {
		t.Fatalf("trusted identity did not bypass phrase block: %v", err)
	}
	if msg.ID == "" {
		t.Fatal("trusted delivery missing message ID")
	}
}

func TestExplicitApplicationBlockWinsOverTrust(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	if _, err := s.PutTrustEntry(ctx, "bob.420", TrustIdentity, "alice.420", TrustAllow); err != nil {
		t.Fatal(err)
	}
	if _, err := s.PutTrustEntry(ctx, "bob.420", TrustApplication, ServiceID, TrustBlock); err != nil {
		t.Fatal(err)
	}
	_, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "app-block", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "body", Source: ServiceID,
	})
	if !errors.Is(err, ErrTrustRejected) {
		t.Fatalf("application block did not win: %v", err)
	}
}

func TestAllowlistModeAcceptsTrustedApplicationAndPhrase(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	if _, err := s.UpdateTrustSettings(ctx, "bob.420", true); err != nil {
		t.Fatal(err)
	}
	_, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "untrusted-reject", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "ordinary body", Source: ServiceID,
	})
	if !errors.Is(err, ErrTrustRejected) {
		t.Fatalf("allowlist-only mode accepted untrusted mail: %v", err)
	}

	app, err := s.PutTrustEntry(ctx, "bob.420", TrustApplication, ServiceID, TrustAllow)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "trusted-app", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "ordinary body", Source: ServiceID,
	}); err != nil {
		t.Fatalf("trusted application rejected: %v", err)
	}
	if err := s.DeleteTrustEntry(ctx, "bob.420", app.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.PutTrustEntry(ctx, "bob.420", TrustPhrase, "approved invoice", TrustAllow); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "trusted-phrase", Sender: "alice.420", Recipient: "bob.420",
		Subject: "Approved   Invoice", Body: "body", Source: ServiceID,
	}); err != nil {
		t.Fatalf("trusted phrase rejected: %v", err)
	}
}

func TestMuteSuppressesNotificationAndOverridesRuleUnmute(t *testing.T) {
	s, notify := testService()
	ctx := context.Background()
	if _, err := s.PutTrustEntry(ctx, "bob.420", TrustIdentity, "alice.420", TrustMute); err != nil {
		t.Fatal(err)
	}
	no := false
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "try to unmute", Condition: RuleCondition{SenderEquals: "alice.420"}, Action: RuleAction{Muted: &no},
	}); err != nil {
		t.Fatal(err)
	}
	msg, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "mute", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "body", Source: ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !state.Muted {
		t.Fatalf("trust mute was overridden by mailbox rule: %+v", state)
	}
	if notify.Count() != 0 {
		t.Fatalf("muted delivery emitted notification: %d", notify.Count())
	}
}

func TestTrustEntryUpsertNormalizationAndOwnerScope(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	first, err := s.PutTrustEntry(ctx, "bob.420", TrustPhrase, "  BaNaNa   Bread ", TrustBlock)
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.PutTrustEntry(ctx, "bob.420", TrustPhrase, "banana bread", TrustAllow)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID || second.Value != "banana bread" || second.Disposition != TrustAllow {
		t.Fatalf("trust upsert/normalization failed: first=%+v second=%+v", first, second)
	}
	if err := s.DeleteTrustEntry(ctx, "alice.420", second.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign trust delete error=%v", err)
	}
	bob, err := s.ListTrustEntries(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	alice, err := s.ListTrustEntries(ctx, "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(bob) != 1 || len(alice) != 0 {
		t.Fatalf("trust entries crossed owner boundary: bob=%+v alice=%+v", bob, alice)
	}
}

func TestIdempotentReplaySurvivesLaterBlock(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	req := SendRequest{
		IdempotencyKey: "trust-replay", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "body", Source: ServiceID,
	}
	first, err := s.Send(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.PutTrustEntry(ctx, "bob.420", TrustIdentity, "alice.420", TrustBlock); err != nil {
		t.Fatal(err)
	}
	again, err := s.Send(ctx, "alice.420", req)
	if err != nil {
		t.Fatalf("idempotent replay was retroactively blocked: %v", err)
	}
	if again.ID != first.ID {
		t.Fatalf("idempotent replay changed message: %s != %s", again.ID, first.ID)
	}
	if _, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "new-after-block", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "body", Source: ServiceID,
	}); !errors.Is(err, ErrTrustRejected) {
		t.Fatalf("new send after block was accepted: %v", err)
	}
}

func TestTrustControlsPersistAcrossRestartAndV3Migration(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	blobs := &testBlobs{}
	first := durableTestService(t, path, blobs)
	entry, err := first.PutTrustEntry(ctx, "bob.420", TrustIdentity, "alice.420", TrustBlock)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := first.UpdateTrustSettings(ctx, "bob.420", true); err != nil {
		t.Fatal(err)
	}
	restarted := durableTestService(t, path, blobs)
	entries, err := restarted.ListTrustEntries(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	settings, err := restarted.GetTrustSettings(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].ID != entry.ID || !settings.RequireTrusted {
		t.Fatalf("trust state did not survive restart: entries=%+v settings=%+v", entries, settings)
	}

	legacyPath := filepath.Join(t.TempDir(), "legacy-v3.json")
	legacy := diskStoreData{
		SchemaVersion:     3,
		Messages:          map[string]Message{},
		ByIdem:            map[string]string{},
		Mailbox:           map[string]MailboxState{},
		MailboxIndex:      map[string][]string{},
		Labels:            map[string]LabelDefinition{},
		CustomFolders:     map[string]CustomFolder{},
		LabelIndex:        map[string][]string{},
		CustomFolderIndex: map[string][]string{},
		Rules:             map[string]MailRule{},
		Fingerprints:      map[string]string{},
		IdempotencyKeys:   map[string]string{},
	}
	raw, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(legacyPath, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	migrated, err := OpenDurableStore(legacyPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := migrated.View(ctx, func(data *storeData) error {
		if data.SchemaVersion != DurableStoreSchemaVersion || data.TrustEntries == nil || data.TrustSettings == nil {
			t.Fatalf("v3->v4 migration incomplete: %+v", data)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}
