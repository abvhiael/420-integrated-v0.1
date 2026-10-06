package mail

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func boolPtr(v bool) *bool { return &v }

func TestRulesApplySenderContentSourceActionsAtomically(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()

	label, err := s.CreateLabel(ctx, "bob.420", "Receipts")
	if err != nil {
		t.Fatal(err)
	}
	custom, err := s.CreateCustomFolder(ctx, "bob.420", "Vendors")
	if err != nil {
		t.Fatal(err)
	}
	archive := FolderArchive
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "Alice archive", Priority: 10,
		Condition: RuleCondition{SenderEquals: "alice.420"},
		Action:    RuleAction{Folder: &archive, AddLabelIDs: []string{label.ID}},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "Banana flag", Priority: 20,
		Condition: RuleCondition{ContentContains: "banana"},
		Action:    RuleAction{Starred: boolPtr(true)},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "Mail source", Priority: 30,
		Condition: RuleCondition{SourceEquals: ServiceID},
		Action: RuleAction{
			CustomFolderID: &custom.ID,
			MarkRead:       boolPtr(true),
			Muted:          boolPtr(true),
		},
	}); err != nil {
		t.Fatal(err)
	}

	msg, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "rules-all",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "Quarterly receipt",
		Body:           "BANANA ledger",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderArchive || len(state.LabelIDs) != 1 || state.LabelIDs[0] != label.ID {
		t.Fatalf("sender rule not applied: %+v", state)
	}
	if state.CustomFolderID != custom.ID || state.ReadAt == nil || !state.Starred || !state.Muted {
		t.Fatalf("content/source actions not applied: %+v", state)
	}

	var stored Message
	if err := s.Store.View(ctx, func(data *storeData) error {
		stored = data.Messages[msg.ID]
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if stored.ReadAt != nil {
		t.Fatal("automated MarkRead incorrectly emitted a message-level human read receipt")
	}
}

func TestRulesOnlyMutateRecipientMailboxCopy(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	junk := FolderJunk
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name:      "Alice to junk",
		Condition: RuleCondition{SenderEquals: "alice.420"},
		Action:    RuleAction{Folder: &junk},
	}); err != nil {
		t.Fatal(err)
	}
	msg, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "recipient-only", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "body", Source: ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	bob, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	alice, err := s.GetMailboxState(ctx, "alice.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if bob.Folder != FolderJunk || alice.Folder != FolderSent {
		t.Fatalf("rule crossed mailbox ownership boundary: bob=%+v alice=%+v", bob, alice)
	}
}

func TestRuleConditionsAreANDed(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	archive := FolderArchive
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "all conditions",
		Condition: RuleCondition{
			SenderEquals:    "alice.420",
			ContentContains: "needle",
			SourceEquals:    ServiceID,
		},
		Action: RuleAction{Folder: &archive},
	}); err != nil {
		t.Fatal(err)
	}
	msg, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "and-rule", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "no match", Source: ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderInbox {
		t.Fatalf("partially matching AND rule fired: %+v", state)
	}
}

func TestRulePriorityStopAndDisabled(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	junk := FolderJunk
	archive := FolderArchive
	disabled := false
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "disabled junk", Enabled: &disabled, Priority: 0,
		Condition: RuleCondition{SenderEquals: "alice.420"},
		Action:    RuleAction{Folder: &junk},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "archive and stop", Priority: 1,
		Condition: RuleCondition{SenderEquals: "alice.420"},
		Action:    RuleAction{Folder: &archive, StopProcessing: true},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "late junk", Priority: 2,
		Condition: RuleCondition{SenderEquals: "alice.420"},
		Action:    RuleAction{Folder: &junk},
	}); err != nil {
		t.Fatal(err)
	}
	msg, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "priority-stop", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "body", Source: ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderArchive {
		t.Fatalf("priority/stop semantics failed: %+v", state)
	}
}

func TestRuleValidationAndOwnerSafety(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	foreignLabel, err := s.CreateLabel(ctx, "alice.420", "Alice")
	if err != nil {
		t.Fatal(err)
	}
	sent := FolderSent

	cases := []RuleInput{
		{Name: "no condition", Action: RuleAction{Starred: boolPtr(true)}},
		{Name: "no action", Condition: RuleCondition{SenderEquals: "alice.420"}},
		{Name: "forbidden folder", Condition: RuleCondition{SenderEquals: "alice.420"}, Action: RuleAction{Folder: &sent}},
		{Name: "foreign label", Condition: RuleCondition{SenderEquals: "alice.420"}, Action: RuleAction{AddLabelIDs: []string{foreignLabel.ID}}},
		{Name: "too much content", Condition: RuleCondition{ContentContains: strings.Repeat("x", MaxRuleContentMatchBytes+1)}, Action: RuleAction{Starred: boolPtr(true)}},
	}
	for _, input := range cases {
		if _, err := s.CreateRule(ctx, "bob.420", input); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("%s error=%v want invalid input", input.Name, err)
		}
	}

	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "Duplicate", Condition: RuleCondition{SenderEquals: "alice.420"}, Action: RuleAction{Starred: boolPtr(true)},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "duplicate", Condition: RuleCondition{SourceEquals: ServiceID}, Action: RuleAction{Muted: boolPtr(true)},
	}); !errors.Is(err, ErrRuleConflict) {
		t.Fatalf("duplicate rule name accepted: %v", err)
	}
}

func TestRuleCRUDIsOwnerScoped(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	rule, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "Original", Condition: RuleCondition{SenderEquals: "alice.420"}, Action: RuleAction{Starred: boolPtr(true)},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpdateRule(ctx, "alice.420", rule.ID, RuleInput{
		Name: "Hijack", Condition: RuleCondition{SourceEquals: ServiceID}, Action: RuleAction{Muted: boolPtr(true)},
	}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign update error=%v", err)
	}
	if err := s.DeleteRule(ctx, "alice.420", rule.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign delete error=%v", err)
	}

	enabled := false
	updated, err := s.UpdateRule(ctx, "bob.420", rule.ID, RuleInput{
		Name: "Updated", Enabled: &enabled, Priority: 7,
		Condition: RuleCondition{ContentContains: "receipt"},
		Action:    RuleAction{Muted: boolPtr(true)},
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "Updated" || updated.Enabled || updated.Priority != 7 {
		t.Fatalf("rule update mismatch: %+v", updated)
	}
	list, err := s.ListRules(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != rule.ID {
		t.Fatalf("rule listing mismatch: %+v", list)
	}
	if err := s.DeleteRule(ctx, "bob.420", rule.ID); err != nil {
		t.Fatal(err)
	}
	list, err = s.ListRules(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 0 {
		t.Fatalf("rule deletion failed: %+v", list)
	}
}

func TestRuleTargetCleanupOnOrganizationDelete(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	label, err := s.CreateLabel(ctx, "bob.420", "Temporary")
	if err != nil {
		t.Fatal(err)
	}
	labelRule, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "label only", Condition: RuleCondition{SenderEquals: "alice.420"}, Action: RuleAction{AddLabelIDs: []string{label.ID}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteLabel(ctx, "bob.420", label.ID); err != nil {
		t.Fatal(err)
	}
	rules, err := s.ListRules(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	for _, rule := range rules {
		if rule.ID == labelRule.ID {
			t.Fatal("rule with no remaining mailbox action survived label deletion")
		}
	}

	folder, err := s.CreateCustomFolder(ctx, "bob.420", "Temporary folder")
	if err != nil {
		t.Fatal(err)
	}
	folderRule, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "folder only", Condition: RuleCondition{SourceEquals: ServiceID}, Action: RuleAction{CustomFolderID: &folder.ID},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteCustomFolder(ctx, "bob.420", folder.ID); err != nil {
		t.Fatal(err)
	}
	rules, err = s.ListRules(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	for _, rule := range rules {
		if rule.ID == folderRule.ID {
			t.Fatal("rule with no remaining mailbox action survived custom-folder deletion")
		}
	}
}

func TestRulesPersistAcrossDurableRestartAndV2Migration(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	blobs := &testBlobs{}
	first := durableTestService(t, path, blobs)
	archive := FolderArchive
	rule, err := first.CreateRule(ctx, "bob.420", RuleInput{
		Name: "durable rule", Condition: RuleCondition{SenderEquals: "alice.420"}, Action: RuleAction{Folder: &archive},
	})
	if err != nil {
		t.Fatal(err)
	}

	restarted := durableTestService(t, path, blobs)
	rules, err := restarted.ListRules(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].ID != rule.ID {
		t.Fatalf("durable rule missing after restart: %+v", rules)
	}
	msg, err := restarted.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "durable-rule-send", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "body", Source: ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := restarted.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderArchive {
		t.Fatalf("restarted rule did not execute: %+v", state)
	}
}

func TestRuleIdempotentResendDoesNotReapplyActions(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	if _, err := s.CreateRule(ctx, "bob.420", RuleInput{
		Name: "star", Condition: RuleCondition{SenderEquals: "alice.420"}, Action: RuleAction{Starred: boolPtr(true)},
	}); err != nil {
		t.Fatal(err)
	}
	req := SendRequest{
		IdempotencyKey: "rule-idempotent", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "body", Source: ServiceID,
	}
	msg, err := s.Send(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	before, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	again, err := s.Send(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	after, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if again.ID != msg.ID || after.Version != before.Version {
		t.Fatalf("idempotent replay reapplied rules: before=%+v after=%+v", before, after)
	}
}

func TestDurableStoreMigratesV2RulesSchema(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy-v2.json")
	legacy := diskStoreData{
		SchemaVersion:     2,
		Messages:          map[string]Message{},
		ByIdem:            map[string]string{},
		Mailbox:           map[string]MailboxState{},
		MailboxIndex:      map[string][]string{},
		Labels:            map[string]LabelDefinition{},
		CustomFolders:     map[string]CustomFolder{},
		LabelIndex:        map[string][]string{},
		CustomFolderIndex: map[string][]string{},
		Fingerprints:      map[string]string{},
		IdempotencyKeys:   map[string]string{},
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
	if err := store.View(context.Background(), func(data *storeData) error {
		if data.SchemaVersion != DurableStoreSchemaVersion || data.Rules == nil {
			t.Fatalf("v2->v3 migration incomplete: %+v", data)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}
