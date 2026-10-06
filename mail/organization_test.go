package mail

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestSystemLabelsExistAndAreImmutable(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	labels, err := s.ListLabels(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(labels) != len(systemLabelNames) {
		t.Fatalf("system labels=%d want %d: %+v", len(labels), len(systemLabelNames), labels)
	}
	for _, label := range labels {
		if !label.System {
			t.Fatalf("non-system label returned before user labels exist: %+v", label)
		}
		if err := s.DeleteLabel(ctx, "bob.420", label.ID); !errors.Is(err, ErrSystemLabelImmutable) {
			t.Fatalf("system label %s was mutable: %v", label.ID, err)
		}
	}
}

func TestUserLabelsAreOwnerScopedAndCaseInsensitiveUnique(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	label, err := s.CreateLabel(ctx, "bob.420", "  Work   Stuff ")
	if err != nil {
		t.Fatal(err)
	}
	if label.Name != "Work Stuff" || label.System {
		t.Fatalf("label normalization failed: %+v", label)
	}
	if _, err := s.CreateLabel(ctx, "bob.420", "work stuff"); !errors.Is(err, ErrOrganizationConflict) {
		t.Fatalf("case-insensitive duplicate accepted: %v", err)
	}
	if _, err := s.CreateLabel(ctx, "alice.420", "work stuff"); err != nil {
		t.Fatalf("different owner could not reuse label name: %v", err)
	}
	bob, err := s.ListLabels(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, got := range bob {
		if got.ID == label.ID {
			found = true
		}
		if got.Owner != "bob.420" {
			t.Fatalf("cross-owner label leaked: %+v", got)
		}
	}
	if !found {
		t.Fatal("user label missing from owner listing")
	}
}

func TestCustomFoldersRejectSystemNamesAndAreOwnerScoped(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	if _, err := s.CreateCustomFolder(ctx, "bob.420", "Inbox"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("reserved system folder name accepted: %v", err)
	}
	folder, err := s.CreateCustomFolder(ctx, "bob.420", "Receipts")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateCustomFolder(ctx, "bob.420", "receipts"); !errors.Is(err, ErrOrganizationConflict) {
		t.Fatalf("duplicate custom folder accepted: %v", err)
	}
	if _, err := s.CreateCustomFolder(ctx, "alice.420", "Receipts"); err != nil {
		t.Fatalf("different owner could not reuse custom folder name: %v", err)
	}
	folders, err := s.ListCustomFolders(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(folders) != 1 || folders[0].ID != folder.ID || folders[0].Owner != "bob.420" {
		t.Fatalf("unexpected folder listing: %+v", folders)
	}
}

func TestBulkOrganizationAssignmentAndIndexes(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	label, err := s.CreateLabel(ctx, "bob.420", "Receipts")
	if err != nil {
		t.Fatal(err)
	}
	folder, err := s.CreateCustomFolder(ctx, "bob.420", "Purchases")
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for i, key := range []string{"bulk-a", "bulk-b"} {
		msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: key, Sender: "alice.420", Recipient: "bob.420", Subject: "receipt", Body: "body", Source: ServiceID})
		if err != nil {
			t.Fatal(err)
		}
		if i == 0 && msg.ID == "" {
			t.Fatal("message id missing")
		}
		ids = append(ids, msg.ID)
	}
	result, err := s.BulkUpdateOrganization(ctx, "bob.420", BulkOrganizationRequest{
		MessageIDs: ids, AddLabelIDs: []string{label.ID}, CustomFolderID: &folder.ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Updated) != 2 {
		t.Fatalf("updated=%d", len(result.Updated))
	}
	byLabel, err := s.MessagesByLabel(ctx, "bob.420", label.ID, "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(byLabel.Items) != 2 {
		t.Fatalf("label index items=%d", len(byLabel.Items))
	}
	byFolder, err := s.MessagesByCustomFolder(ctx, "bob.420", folder.ID, "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(byFolder.Items) != 2 {
		t.Fatalf("folder index items=%d", len(byFolder.Items))
	}
}

func TestBulkOrganizationIsAtomicAndOwnerSafe(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	label, err := s.CreateLabel(ctx, "bob.420", "Private")
	if err != nil {
		t.Fatal(err)
	}
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "atomic", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "y", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.BulkUpdateOrganization(ctx, "bob.420", BulkOrganizationRequest{
		MessageIDs: []string{msg.ID, "missing"}, AddLabelIDs: []string{label.ID},
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("bulk with missing message should fail atomically: %v", err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(state.LabelIDs) != 0 {
		t.Fatalf("failed bulk partially applied: %+v", state)
	}

	aliceLabel, err := s.CreateLabel(ctx, "alice.420", "Alice only")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpdateOrganization(ctx, "bob.420", msg.ID, OrganizationUpdate{AddLabelIDs: []string{aliceLabel.ID}}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("cross-owner label assignment accepted: %v", err)
	}
}

func TestDeleteOrganizationDefinitionCleansAssignments(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	label, _ := s.CreateLabel(ctx, "bob.420", "Temp")
	folder, _ := s.CreateCustomFolder(ctx, "bob.420", "Temp Folder")
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "cleanup", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "y", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpdateOrganization(ctx, "bob.420", msg.ID, OrganizationUpdate{AddLabelIDs: []string{label.ID}, CustomFolderID: &folder.ID}); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteLabel(ctx, "bob.420", label.ID); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteCustomFolder(ctx, "bob.420", folder.ID); err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(state.LabelIDs) != 0 || state.CustomFolderID != "" {
		t.Fatalf("deleted organization references remained: %+v", state)
	}
}

func TestDurableOrganizationSurvivesRestartAndSchemaOneMigration(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail.json")
	blobs := &testBlobs{}
	s := durableTestService(t, path, blobs)
	label, err := s.CreateLabel(ctx, "bob.420", "Durable")
	if err != nil {
		t.Fatal(err)
	}
	folder, err := s.CreateCustomFolder(ctx, "bob.420", "Durable Folder")
	if err != nil {
		t.Fatal(err)
	}
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "org-restart", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "y", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpdateOrganization(ctx, "bob.420", msg.ID, OrganizationUpdate{AddLabelIDs: []string{label.ID}, CustomFolderID: &folder.ID}); err != nil {
		t.Fatal(err)
	}
	restarted := durableTestService(t, path, blobs)
	state, err := restarted.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(state.LabelIDs) != 1 || state.LabelIDs[0] != label.ID || state.CustomFolderID != folder.ID {
		t.Fatalf("organization did not survive restart: %+v", state)
	}

	legacyPath := filepath.Join(t.TempDir(), "legacy-v1.json")
	legacy := diskStoreData{
		SchemaVersion:   1,
		Messages:        map[string]Message{},
		ByIdem:          map[string]string{},
		Mailbox:         map[string]MailboxState{},
		MailboxIndex:    map[string][]string{},
		Fingerprints:    map[string]string{},
		IdempotencyKeys: map[string]string{},
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
		if data.SchemaVersion != DurableStoreSchemaVersion || data.Labels == nil || data.CustomFolders == nil || data.LabelIndex == nil || data.CustomFolderIndex == nil {
			t.Fatalf("v1 migration incomplete: %+v", data)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}


func TestSystemLabelViewsReflectMailboxState(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "system-view", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	labels, err := s.ListLabels(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	byName := map[string]string{}
	for _, label := range labels {
		byName[label.Name] = label.ID
	}
	unread, err := s.MessagesByLabel(ctx, "bob.420", byName["UNREAD"], "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(unread.Items) != 1 || unread.Items[0].Message.ID != msg.ID {
		t.Fatalf("unread system label missing message: %+v", unread)
	}
	yes := true
	if _, err := s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Read: &yes, Starred: &yes, Pinned: &yes, Muted: &yes}); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"STARRED", "PINNED", "MUTED"} {
		page, err := s.MessagesByLabel(ctx, "bob.420", byName[name], "", 10)
		if err != nil {
			t.Fatal(err)
		}
		if len(page.Items) != 1 || page.Items[0].Message.ID != msg.ID {
			t.Fatalf("%s system label missing message: %+v", name, page)
		}
	}
	unread, err = s.MessagesByLabel(ctx, "bob.420", byName["UNREAD"], "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(unread.Items) != 0 {
		t.Fatalf("read message remained in UNREAD system label: %+v", unread)
	}
}
