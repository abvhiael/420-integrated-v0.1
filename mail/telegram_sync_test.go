package mail

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type telegramFullAuthorityStub struct {
	telegramLinkAuthorityStub
	page  TelegramSyncPage
	pulls []string
}

func (s *telegramFullAuthorityStub) PullTelegram(_ context.Context, actor, userID, cursor string) (TelegramSyncPage, error) {
	s.pulls = append(s.pulls, actor+"|"+userID+"|"+cursor)
	if s.err != nil {
		return TelegramSyncPage{}, s.err
	}
	return s.page, nil
}

func validTelegramInboundMessage() TelegramInboundMessage {
	return TelegramInboundMessage{
		MessageID:      "42",
		AuthorID:       "2234567890",
		AuthorUsername: "bob",
		ChatID:         "-1001234567890",
		ChatTitle:      "420 Friends",
		Content:        "hello from telegram",
		CreatedAt:      time.Unix(1700000700, 0).UTC(),
	}
}

func telegramSyncHarness(t *testing.T, store MailStore, authority *telegramFullAuthorityStub) (*TelegramSyncService, *Service) {
	t.Helper()
	mailSvc := NewService(testIDs{"alice.420": true}, testPolicy{}, &testBlobs{}, &testNotify{}, store)
	mailSvc.Now = func() time.Time { return time.Unix(1700000800, 0).UTC() }
	connectors, err := NewTelegramConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	return NewTelegramSyncService(connectors, mailSvc), mailSvc
}

func TestTelegramSyncMaterializesPrivateInboxMessage(t *testing.T) {
	msg := validTelegramInboundMessage()
	authority := &telegramFullAuthorityStub{
		telegramLinkAuthorityStub: telegramLinkAuthorityStub{account: validTelegramAccount()},
		page:                      TelegramSyncPage{Messages: []TelegramInboundMessage{msg}, NextCursor: "cursor-1"},
	}
	syncer, mailSvc := telegramSyncHarness(t, NewMemoryStore(), authority)
	out, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890")
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Imported) != 1 || out.NextCursor != "cursor-1" {
		t.Fatalf("unexpected sync result: %+v", out)
	}
	item := out.Imported[0]
	if item.Message.Sender != "telegram:2234567890" ||
		item.Message.Recipient != "alice.420" ||
		item.Message.Source != TelegramProvider ||
		item.Message.Visibility != "PRIVATE" ||
		item.State.Folder != FolderInbox ||
		item.Message.Subject != "Telegram · 420 Friends" {
		t.Fatalf("unexpected materialization: %+v", item)
	}
	body, stored, err := mailSvc.ReadBody(context.Background(), "alice.420", item.Message.ID)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != msg.Content || stored.BodyRef == "" || stored.BodyDigest == "" {
		t.Fatalf("private body mismatch: body=%q msg=%+v", body, stored)
	}
}

func TestTelegramSyncIsIdempotentAndCursorAdvances(t *testing.T) {
	msg := validTelegramInboundMessage()
	authority := &telegramFullAuthorityStub{page: TelegramSyncPage{Messages: []TelegramInboundMessage{msg}, NextCursor: "cursor-1"}}
	syncer, _ := telegramSyncHarness(t, NewMemoryStore(), authority)
	first, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890")
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Imported) != 1 {
		t.Fatalf("first import count=%d", len(first.Imported))
	}
	authority.page = TelegramSyncPage{Messages: []TelegramInboundMessage{msg}, NextCursor: "cursor-2"}
	second, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890")
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Imported) != 0 || second.NextCursor != "cursor-2" {
		t.Fatalf("unexpected replay result: %+v", second)
	}
	if len(authority.pulls) != 2 || authority.pulls[1] != "alice.420|1234567890|cursor-1" {
		t.Fatalf("cursor not reused: %+v", authority.pulls)
	}
}

func TestTelegramSyncReplayDoesNotResurrectPermanentlyDeletedMessage(t *testing.T) {
	msg := validTelegramInboundMessage()
	authority := &telegramFullAuthorityStub{page: TelegramSyncPage{Messages: []TelegramInboundMessage{msg}, NextCursor: "cursor-1"}}
	syncer, mailSvc := telegramSyncHarness(t, NewMemoryStore(), authority)
	first, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890")
	if err != nil {
		t.Fatal(err)
	}
	id := first.Imported[0].Message.ID
	trash := FolderTrash
	if _, err := mailSvc.UpdateMailbox(context.Background(), "alice.420", id, MailboxUpdate{Folder: &trash}); err != nil {
		t.Fatal(err)
	}
	if err := mailSvc.PermanentlyDelete(context.Background(), "alice.420", id); err != nil {
		t.Fatal(err)
	}
	authority.page = TelegramSyncPage{Messages: []TelegramInboundMessage{msg}, NextCursor: "cursor-2"}
	replay, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890")
	if err != nil {
		t.Fatal(err)
	}
	if len(replay.Imported) != 0 {
		t.Fatalf("deleted message resurrected: %+v", replay.Imported)
	}
	if _, err := mailSvc.GetMailboxState(context.Background(), "alice.420", id); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted mailbox state became visible again: %v", err)
	}
}

func TestTelegramSyncRejectsExternalIDMutation(t *testing.T) {
	msg := validTelegramInboundMessage()
	authority := &telegramFullAuthorityStub{page: TelegramSyncPage{Messages: []TelegramInboundMessage{msg}}}
	syncer, _ := telegramSyncHarness(t, NewMemoryStore(), authority)
	if _, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890"); err != nil {
		t.Fatal(err)
	}
	msg.Content = "mutated telegram payload"
	authority.page = TelegramSyncPage{Messages: []TelegramInboundMessage{msg}}
	if _, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890"); !errors.Is(err, ErrTelegramSyncConflict) {
		t.Fatalf("external ID mutation accepted: %v", err)
	}
}

func TestTelegramSyncValidatesProviderMessageShapeBeforeMaterialization(t *testing.T) {
	base := validTelegramInboundMessage()
	for _, mutate := range []func(*TelegramInboundMessage){
		func(m *TelegramInboundMessage) { m.MessageID = "bad" },
		func(m *TelegramInboundMessage) { m.AuthorID = "bad" },
		func(m *TelegramInboundMessage) { m.ChatID = "--1" },
		func(m *TelegramInboundMessage) { m.CreatedAt = time.Time{} },
	} {
		msg := base
		mutate(&msg)
		raw, _ := json.Marshal(msg)
		adapter := testConnectorAdapter(TelegramProvider, ConnectorCapabilityPull)
		adapter.pull = ConnectorPullResult{
			Provider:     TelegramProvider,
			ConnectionID: "telegram:1234567890",
			Items:        []ConnectorItem{{ExternalID: msg.MessageID, OccurredAt: msg.CreatedAt, Kind: TelegramSyncItemKind, Payload: string(raw)}},
		}
		reg, _ := NewConnectorRegistry(adapter)
		mailSvc := NewService(testIDs{"alice.420": true}, testPolicy{}, &testBlobs{}, &testNotify{}, NewMemoryStore())
		syncer := NewTelegramSyncService(NewConnectorService(reg), mailSvc)
		if _, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890"); !errors.Is(err, ErrTelegramInvalidResult) && !errors.Is(err, ErrConnectorInvalidResult) {
			t.Fatalf("invalid Telegram message accepted: %+v err=%v", msg, err)
		}
	}
}

func TestTelegramSyncStoreMigratesV10ToV11(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy-v10.json")
	if err := os.WriteFile(path, []byte("{\"schema_version\":10}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.View(context.Background(), func(data *storeData) error {
		if data.SchemaVersion != 11 || data.TelegramSync == nil {
			t.Fatalf("v10->v11 Telegram sync migration incomplete: schema=%d telegram=%v", data.SchemaVersion, data.TelegramSync)
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
	if disk.SchemaVersion != 11 || disk.TelegramSync == nil {
		t.Fatalf("persisted v11 migration incomplete: schema=%d telegram=%v", disk.SchemaVersion, disk.TelegramSync)
	}
}

func TestTelegramSyncDurableCursorSurvivesRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mail.json")
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	msg := validTelegramInboundMessage()
	authority := &telegramFullAuthorityStub{page: TelegramSyncPage{Messages: []TelegramInboundMessage{msg}, NextCursor: "restart-cursor"}}
	syncer, _ := telegramSyncHarness(t, store, authority)
	if _, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890"); err != nil {
		t.Fatal(err)
	}

	store2, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	authority2 := &telegramFullAuthorityStub{page: TelegramSyncPage{NextCursor: "after-restart"}}
	syncer2, _ := telegramSyncHarness(t, store2, authority2)
	if _, err := syncer2.Sync(context.Background(), "alice.420", "telegram:1234567890"); err != nil {
		t.Fatal(err)
	}
	if len(authority2.pulls) != 1 || authority2.pulls[0] != "alice.420|1234567890|restart-cursor" {
		t.Fatalf("restart cursor lost: %+v", authority2.pulls)
	}
}

func TestTelegramSyncDependencyFailureDoesNotAdvanceCursor(t *testing.T) {
	authority := &telegramFullAuthorityStub{page: TelegramSyncPage{NextCursor: "cursor-1"}}
	syncer, _ := telegramSyncHarness(t, NewMemoryStore(), authority)
	if _, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890"); err != nil {
		t.Fatal(err)
	}
	authority.err = errors.New("telegram unavailable")
	if _, err := syncer.Sync(context.Background(), "alice.420", "telegram:1234567890"); err == nil {
		t.Fatal("dependency failure unexpectedly succeeded")
	}
	if len(authority.pulls) < 2 || authority.pulls[len(authority.pulls)-1] != "alice.420|1234567890|cursor-1" {
		t.Fatalf("cursor advanced on failure: %+v", authority.pulls)
	}
}

func TestTelegramAdapterAdvertisesPullOnlyWithSyncAuthority(t *testing.T) {
	linkOnly := NewTelegramConnectorAdapter(&telegramLinkAuthorityStub{account: validTelegramAccount()}).Descriptor()
	if connectorHasCapability(linkOnly, ConnectorCapabilityPull) {
		t.Fatalf("link-only authority advertised PULL: %+v", linkOnly)
	}
	full := NewTelegramConnectorAdapter(&telegramFullAuthorityStub{}).Descriptor()
	if !connectorHasCapability(full, ConnectorCapabilityLink) || !connectorHasCapability(full, ConnectorCapabilityPull) ||
		connectorHasCapability(full, ConnectorCapabilityPush) || connectorHasCapability(full, ConnectorCapabilityWebhook) ||
		connectorHasCapability(full, ConnectorCapabilityWalletVerify) {
		t.Fatalf("unexpected Telegram sync capabilities: %+v", full.Capabilities)
	}
}
