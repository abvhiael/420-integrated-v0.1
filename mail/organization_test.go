package mail

import (
	"context"
	"errors"
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

	if err := restarted.Store.Update(ctx, func(data *storeData) error {
		data.SchemaVersion = 1
		return nil
	}); err == nil {
		t.Fatal("store transaction unexpectedly allowed schema downgrade")
	}
}
