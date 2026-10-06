package mail

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func TestReplyConversationParticipantsAndOrdering(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	now := time.Unix(1700000000, 0).UTC()
	s.Now = func() time.Time { return now }

	root, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "thread-root",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "root",
		Body:           "root body",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if root.ConversationID == "" || root.ReplyTo != "" {
		t.Fatalf("root conversation metadata invalid: %+v", root)
	}

	now = now.Add(time.Minute)
	reply, err := s.Reply(ctx, "bob.420", root.ID, ReplyRequest{
		IdempotencyKey: "thread-reply-1",
		Subject:        "re: root",
		Body:           "reply body",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if reply.ConversationID != root.ConversationID || reply.ReplyTo != root.ID || reply.Recipient != "alice.420" {
		t.Fatalf("reply metadata invalid: root=%+v reply=%+v", root, reply)
	}

	now = now.Add(time.Minute)
	reply2, err := s.Reply(ctx, "alice.420", reply.ID, ReplyRequest{
		IdempotencyKey: "thread-reply-2",
		Subject:        "re: root",
		Body:           "second reply",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}

	view, err := s.GetConversation(ctx, "bob.420", root.ConversationID)
	if err != nil {
		t.Fatal(err)
	}
	if view.ID != root.ConversationID || view.MessageCount != 3 {
		t.Fatalf("unexpected conversation view: %+v", view)
	}
	if !reflect.DeepEqual(view.Participants, []string{"alice.420", "bob.420"}) {
		t.Fatalf("unexpected participants: %v", view.Participants)
	}
	if len(view.Items) != 3 || view.Items[0].Message.ID != root.ID || view.Items[1].Message.ID != reply.ID || view.Items[2].Message.ID != reply2.ID {
		t.Fatalf("conversation order not oldest-to-newest: %+v", view.Items)
	}

	list, err := s.ListConversations(ctx, "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != root.ConversationID || !list[0].LatestAt.Equal(reply2.CreatedAt) {
		t.Fatalf("conversation summary invalid: %+v", list)
	}
}

func TestConversationListNewestThreadFirst(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	now := time.Unix(1700000000, 0).UTC()
	s.Now = func() time.Time { return now }

	first, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "thread-a",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "a",
		Body:           "a",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(time.Minute)
	second, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "thread-b",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "b",
		Body:           "b",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	list, err := s.ListConversations(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].ID != second.ConversationID || list[1].ID != first.ConversationID {
		t.Fatalf("conversation list order invalid: %+v", list)
	}
}

func TestConversationArchiveMuteAndFutureDelivery(t *testing.T) {
	s, notify := testService()
	ctx := context.Background()

	root, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "thread-state-root",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "root",
		Body:           "root",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if notify.Count() != 1 {
		t.Fatalf("root notification count=%d", notify.Count())
	}
	yes := true
	state, err := s.UpdateConversation(ctx, "bob.420", root.ConversationID, ConversationUpdate{Archived: &yes, Muted: &yes})
	if err != nil {
		t.Fatal(err)
	}
	if !state.Archived || !state.Muted {
		t.Fatalf("thread state not applied: %+v", state)
	}
	rootState, err := s.GetMailboxState(ctx, "bob.420", root.ID)
	if err != nil {
		t.Fatal(err)
	}
	if rootState.Folder != FolderArchive {
		t.Fatalf("archive did not move inbox copy: %+v", rootState)
	}

	reply, err := s.Reply(ctx, "bob.420", root.ID, ReplyRequest{
		IdempotencyKey: "thread-state-bob-reply",
		Subject:        "re",
		Body:           "from bob",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if notify.Count() != 2 {
		t.Fatalf("outgoing reply should notify alice: %d", notify.Count())
	}

	incoming, err := s.Reply(ctx, "alice.420", reply.ID, ReplyRequest{
		IdempotencyKey: "thread-state-alice-reply",
		Subject:        "re",
		Body:           "from alice",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	incomingState, err := s.GetMailboxState(ctx, "bob.420", incoming.ID)
	if err != nil {
		t.Fatal(err)
	}
	if incomingState.Folder != FolderArchive || !incomingState.Muted {
		t.Fatalf("archived/muted thread did not affect future delivery: %+v", incomingState)
	}
	if notify.Count() != 2 {
		t.Fatalf("muted thread emitted notification: %d", notify.Count())
	}

	no := false
	state, err = s.UpdateConversation(ctx, "bob.420", root.ConversationID, ConversationUpdate{Archived: &no, Muted: &no})
	if err != nil {
		t.Fatal(err)
	}
	if state.Archived || state.Muted {
		t.Fatalf("thread state did not clear: %+v", state)
	}
	rootState, err = s.GetMailboxState(ctx, "bob.420", root.ID)
	if err != nil {
		t.Fatal(err)
	}
	if rootState.Folder != FolderInbox {
		t.Fatalf("unarchive did not restore thread inbox copy: %+v", rootState)
	}
}

func TestConversationAuthorizationAndInjectionDefense(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	root, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "auth-root",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "root",
		Body:           "root",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := s.GetConversation(ctx, "mallory.420", root.ConversationID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign conversation read error=%v", err)
	}
	if _, err := s.Reply(ctx, "mallory.420", root.ID, ReplyRequest{IdempotencyKey: "x", Subject: "x", Body: "x", Source: ServiceID}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign reply error=%v", err)
	}
	if _, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "inject-root",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "inject",
		Body:           "inject",
		ConversationID: root.ConversationID,
		Source:         ServiceID,
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("root conversation injection accepted: %v", err)
	}
	if _, err := s.Send(ctx, "bob.420", SendRequest{
		IdempotencyKey: "reply-wrong-conversation",
		Sender:         "bob.420",
		Recipient:      "alice.420",
		Subject:        "re",
		Body:           "re",
		ReplyTo:        root.ID,
		ConversationID: "conv_forged",
		Source:         ServiceID,
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("reply conversation mismatch accepted: %v", err)
	}
	if _, err := s.Send(ctx, "bob.420", SendRequest{
		IdempotencyKey: "reply-wrong-recipient",
		Sender:         "bob.420",
		Recipient:      "bob.420",
		Subject:        "re",
		Body:           "re",
		ReplyTo:        root.ID,
		ConversationID: root.ConversationID,
		Source:         ServiceID,
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("reply participant mismatch accepted: %v", err)
	}
}

func TestDeletedParentCannotBeUsedForReply(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	root, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "deleted-parent",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "root",
		Body:           "root",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	trash := FolderTrash
	if _, err := s.UpdateMailbox(ctx, "bob.420", root.ID, MailboxUpdate{Folder: &trash}); err != nil {
		t.Fatal(err)
	}
	if err := s.PermanentlyDelete(ctx, "bob.420", root.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Reply(ctx, "bob.420", root.ID, ReplyRequest{
		IdempotencyKey: "deleted-parent-reply",
		Subject:        "re",
		Body:           "body",
		Source:         ServiceID,
	}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted parent reply error=%v", err)
	}
}

func TestConversationV5MigrationBackfillsRootThreadsAndPersistsState(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	id := deterministicMessageID("alice.420", "bob.420", "legacy-thread")
	now := time.Unix(1700000000, 0).UTC()
	msg := Message{
		ID: id, Sender: "alice.420", Recipient: "bob.420", Subject: "legacy",
		BodyRef: "private:bob:legacy", BodyDigest: "digest", CreatedAt: now, UpdatedAt: now,
		Status: "DELIVERED", Visibility: "PRIVATE", Source: ServiceID, Version: 1,
	}
	legacy := diskStoreData{
		SchemaVersion: 5,
		Messages:      map[string]Message{id: msg},
		ByIdem:        map[string]string{"alice.420\x00legacy-thread": id},
		Mailbox: map[string]MailboxState{
			mailboxKey("alice.420", id): {MessageID: id, Owner: "alice.420", Folder: FolderSent, UpdatedAt: now, Version: 1},
			mailboxKey("bob.420", id):   {MessageID: id, Owner: "bob.420", Folder: FolderInbox, UpdatedAt: now, Version: 1},
		},
		Fingerprints:    map[string]string{id: "legacy-fingerprint"},
		IdempotencyKeys: map[string]string{id: "legacy-thread"},
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
	var conversationID string
	if err := store.View(ctx, func(data *storeData) error {
		if data.SchemaVersion != DurableStoreSchemaVersion {
			t.Fatalf("schema=%d", data.SchemaVersion)
		}
		recovered := data.Messages[id]
		conversationID = recovered.ConversationID
		if conversationID != deterministicConversationID(id) {
			t.Fatalf("migration conversation id=%q", conversationID)
		}
		if len(data.ConversationIndex[conversationIndexKey("bob.420", conversationID)]) != 1 {
			t.Fatalf("migration conversation index=%+v", data.ConversationIndex)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	s := NewServiceWithStore(testIDs{"alice.420": true, "bob.420": true}, testPolicy{}, &testBlobs{}, nil, store)
	s.Now = func() time.Time { return now.Add(time.Minute) }
	yes := true
	if _, err := s.UpdateConversation(ctx, "bob.420", conversationID, ConversationUpdate{Muted: &yes}); err != nil {
		t.Fatal(err)
	}
	restarted, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := restarted.View(ctx, func(data *storeData) error {
		state := data.ConversationStates[conversationStateKey("bob.420", conversationID)]
		if !state.Muted || state.Version == 0 {
			t.Fatalf("conversation state did not survive restart: %+v", state)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}
