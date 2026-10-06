package mail

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
	"time"
)

type discordFullAuthorityStub struct {
	discordLinkAuthorityStub
	page   DiscordSyncPage
	pulls  []string
}

func (s *discordFullAuthorityStub) PullDiscord(_ context.Context, actor, userID, cursor string) (DiscordSyncPage, error) {
	s.calls = append(s.calls, "pull:"+actor)
	s.pulls = append(s.pulls, userID+"|"+cursor)
	if s.err != nil {
		return DiscordSyncPage{}, s.err
	}
	return s.page, nil
}

func validDiscordInboundMessage() DiscordInboundMessage {
	return DiscordInboundMessage{
		MessageID: "223456789012345678", AuthorID: "323456789012345678", AuthorUsername: "bob",
		ChannelID: "423456789012345678", ChannelName: "general", Content: "hello from discord",
		CreatedAt: time.Unix(1700000100, 0).UTC(),
	}
}

func discordSyncHarness(t *testing.T, store MailStore, authority *discordFullAuthorityStub) (*DiscordSyncService, *Service) {
	t.Helper()
	blobs := &blobStub{}
	notify := &notifyStub{}
	mailSvc := NewService(&identityStub{}, &messengerStub{}, blobs, notify, store)
	mailSvc.Now = func() time.Time { return time.Unix(1700000200, 0).UTC() }
	connectors, err := NewDiscordConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	return NewDiscordSyncService(connectors, mailSvc), mailSvc
}

func TestDiscordSyncMaterializesPrivateInboxMessage(t *testing.T) {
	msg := validDiscordInboundMessage()
	authority := &discordFullAuthorityStub{discordLinkAuthorityStub: discordLinkAuthorityStub{account: validDiscordAccount()}, page: DiscordSyncPage{Messages: []DiscordInboundMessage{msg}, NextCursor: "cursor-1"}}
	syncer, mailSvc := discordSyncHarness(t, NewMemoryStore(), authority)

	out, err := syncer.Sync(context.Background(), "alice.420", "discord:123456789012345678")
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Imported) != 1 || out.NextCursor != "cursor-1" {
		t.Fatalf("unexpected sync result: %+v", out)
	}
	item := out.Imported[0]
	if item.Message.Sender != "discord:323456789012345678" || item.Message.Recipient != "alice.420" ||
		item.Message.Source != DiscordProvider || item.Message.Visibility != "PRIVATE" || item.State.Folder != FolderInbox {
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

func TestDiscordSyncIsIdempotentAndCursorAdvances(t *testing.T) {
	msg := validDiscordInboundMessage()
	authority := &discordFullAuthorityStub{page: DiscordSyncPage{Messages: []DiscordInboundMessage{msg}, NextCursor: "cursor-1"}}
	syncer, _ := discordSyncHarness(t, NewMemoryStore(), authority)
	first, err := syncer.Sync(context.Background(), "alice.420", "discord:123456789012345678")
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Imported) != 1 {
		t.Fatalf("first import count=%d", len(first.Imported))
	}
	authority.page = DiscordSyncPage{Messages: []DiscordInboundMessage{msg}, NextCursor: "cursor-2"}
	second, err := syncer.Sync(context.Background(), "alice.420", "discord:123456789012345678")
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Imported) != 0 || second.NextCursor != "cursor-2" {
		t.Fatalf("unexpected replay result: %+v", second)
	}
	if len(authority.pulls) != 2 || authority.pulls[1] != "123456789012345678|cursor-1" {
		t.Fatalf("cursor not reused: %+v", authority.pulls)
	}
}

func TestDiscordSyncRejectsExternalIDMutation(t *testing.T) {
	msg := validDiscordInboundMessage()
	authority := &discordFullAuthorityStub{page: DiscordSyncPage{Messages: []DiscordInboundMessage{msg}}}
	syncer, _ := discordSyncHarness(t, NewMemoryStore(), authority)
	if _, err := syncer.Sync(context.Background(), "alice.420", "discord:123456789012345678"); err != nil {
		t.Fatal(err)
	}
	msg.Content = "mutated discord payload"
	authority.page = DiscordSyncPage{Messages: []DiscordInboundMessage{msg}}
	if _, err := syncer.Sync(context.Background(), "alice.420", "discord:123456789012345678"); !errors.Is(err, ErrDiscordSyncConflict) {
		t.Fatalf("external ID mutation accepted: %v", err)
	}
}

func TestDiscordSyncValidatesProviderMessageShapeBeforeMaterialization(t *testing.T) {
	base := validDiscordInboundMessage()
	for _, mutate := range []func(*DiscordInboundMessage){
		func(m *DiscordInboundMessage) { m.MessageID = "bad" },
		func(m *DiscordInboundMessage) { m.AuthorID = "bad" },
		func(m *DiscordInboundMessage) { m.ChannelID = "bad" },
		func(m *DiscordInboundMessage) { m.AuthorUsername = "" },
		func(m *DiscordInboundMessage) { m.CreatedAt = time.Time{} },
	} {
		msg := base
		mutate(&msg)
		raw, _ := json.Marshal(msg)
		adapter := testConnectorAdapter(DiscordProvider, ConnectorCapabilityPull)
		adapter.pull = ConnectorPullResult{Provider: DiscordProvider, ConnectionID: "discord:123456789012345678", Items: []ConnectorItem{{ExternalID: msg.MessageID, OccurredAt: msg.CreatedAt, Kind: DiscordSyncItemKind, Payload: string(raw)}}}
		reg, _ := NewConnectorRegistry(adapter)
		mailSvc := NewService(&identityStub{}, &messengerStub{}, &blobStub{}, &notifyStub{}, NewMemoryStore())
		syncer := NewDiscordSyncService(NewConnectorService(reg), mailSvc)
		if _, err := syncer.Sync(context.Background(), "alice.420", "discord:123456789012345678"); !errors.Is(err, ErrDiscordInvalidResult) {
			t.Fatalf("invalid Discord message accepted: %+v err=%v", msg, err)
		}
	}
}

func TestDiscordSyncDurableCursorSurvivesRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mail.json")
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	msg := validDiscordInboundMessage()
	authority := &discordFullAuthorityStub{page: DiscordSyncPage{Messages: []DiscordInboundMessage{msg}, NextCursor: "restart-cursor"}}
	syncer, _ := discordSyncHarness(t, store, authority)
	if _, err := syncer.Sync(context.Background(), "alice.420", "discord:123456789012345678"); err != nil {
		t.Fatal(err)
	}

	store2, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	authority2 := &discordFullAuthorityStub{page: DiscordSyncPage{NextCursor: "after-restart"}}
	syncer2, _ := discordSyncHarness(t, store2, authority2)
	if _, err := syncer2.Sync(context.Background(), "alice.420", "discord:123456789012345678"); err != nil {
		t.Fatal(err)
	}
	if len(authority2.pulls) != 1 || authority2.pulls[0] != "123456789012345678|restart-cursor" {
		t.Fatalf("restart cursor lost: %+v", authority2.pulls)
	}
}

func TestDiscordSyncDependencyFailureDoesNotAdvanceCursor(t *testing.T) {
	authority := &discordFullAuthorityStub{page: DiscordSyncPage{NextCursor: "cursor-1"}}
	syncer, _ := discordSyncHarness(t, NewMemoryStore(), authority)
	if _, err := syncer.Sync(context.Background(), "alice.420", "discord:123456789012345678"); err != nil {
		t.Fatal(err)
	}
	authority.err = errors.New("discord unavailable")
	if _, err := syncer.Sync(context.Background(), "alice.420", "discord:123456789012345678"); err == nil {
		t.Fatal("dependency failure unexpectedly succeeded")
	}
	if len(authority.pulls) < 2 || authority.pulls[len(authority.pulls)-1] != "123456789012345678|cursor-1" {
		t.Fatalf("cursor advanced on failure: %+v", authority.pulls)
	}
}
