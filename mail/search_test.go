package mail

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestPrivateSearchFindsMetadataAndBody(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "search-1", Sender: "alice.420", Recipient: "bob.420", Subject: "Quarterly Receipt", Body: "secret banana ledger", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}

	bySubject, err := s.SearchMailbox(ctx, "bob.420", SearchRequest{Query: "quarterly"})
	if err != nil {
		t.Fatal(err)
	}
	if len(bySubject.Items) != 1 || bySubject.Items[0].Message.ID != msg.ID {
		t.Fatalf("subject search mismatch: %+v", bySubject)
	}

	byBody, err := s.SearchMailbox(ctx, "bob.420", SearchRequest{Query: "banana"})
	if err != nil {
		t.Fatal(err)
	}
	if len(byBody.Items) != 1 || byBody.Items[0].Message.ID != msg.ID {
		t.Fatalf("body search mismatch: %+v", byBody)
	}
}

func TestPrivateSearchIsOwnerScoped(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "owner-search", Sender: "alice.420", Recipient: "bob.420", Subject: "Private", Body: "needle", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	foreign, err := s.SearchMailbox(ctx, "mallory.420", SearchRequest{Query: "needle"})
	if err != nil {
		t.Fatal(err)
	}
	if len(foreign.Items) != 0 {
		t.Fatalf("foreign actor saw private mail: %+v", foreign)
	}
	own, err := s.SearchMailbox(ctx, "alice.420", SearchRequest{Query: "needle"})
	if err != nil {
		t.Fatal(err)
	}
	if len(own.Items) != 1 || own.Items[0].Message.ID != msg.ID {
		t.Fatalf("sender could not search own sent copy: %+v", own)
	}
}

func TestPrivateSearchFiltersAndDeletedExclusion(t *testing.T) {
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
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "filter-search", Sender: "alice.420", Recipient: "bob.420", Subject: "Invoice", Body: "invoice body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpdateOrganization(ctx, "bob.420", msg.ID, OrganizationUpdate{AddLabelIDs: []string{label.ID}, CustomFolderID: &folder.ID}); err != nil {
		t.Fatal(err)
	}
	starred := true
	if _, err := s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Starred: &starred}); err != nil {
		t.Fatal(err)
	}

	res, err := s.SearchMailbox(ctx, "bob.420", SearchRequest{
		Query: "invoice", LabelID: label.ID, CustomFolderID: folder.ID, Sender: "alice.420", Source: ServiceID, Starred: &starred,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Items) != 1 {
		t.Fatalf("filtered search mismatch: %+v", res)
	}

	trash := FolderTrash
	if _, err := s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Folder: &trash}); err != nil {
		t.Fatal(err)
	}
	if err := s.PermanentlyDelete(ctx, "bob.420", msg.ID); err != nil {
		t.Fatal(err)
	}
	res, err = s.SearchMailbox(ctx, "bob.420", SearchRequest{Query: "invoice"})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Items) != 0 {
		t.Fatalf("permanently deleted mailbox copy remained searchable: %+v", res)
	}
}

func TestPrivateSearchBoundsAndValidation(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	if _, err := s.SearchMailbox(ctx, "", SearchRequest{}); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("empty actor error=%v", err)
	}
	if _, err := s.SearchMailbox(ctx, "bob.420", SearchRequest{Query: strings.Repeat("x", MaxSearchQueryBytes+1)}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("oversized search query accepted: %v", err)
	}
	bad := MailboxFolder("NOPE")
	if _, err := s.SearchMailbox(ctx, "bob.420", SearchRequest{Folder: &bad}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid folder accepted: %v", err)
	}
	now := time.Now().UTC()
	before := now.Add(-time.Hour)
	if _, err := s.SearchMailbox(ctx, "bob.420", SearchRequest{After: &now, Before: &before}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid time range accepted: %v", err)
	}
}

func TestPrivateSearchPagination(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		if _, err := s.Send(ctx, "alice.420", SendRequest{
			IdempotencyKey: "page-search-" + string(rune('a'+i)),
			Sender:         "alice.420", Recipient: "bob.420", Subject: "Searchable", Body: "body", Source: ServiceID,
		}); err != nil {
			t.Fatal(err)
		}
	}
	p1, err := s.SearchMailbox(ctx, "bob.420", SearchRequest{Query: "searchable", Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(p1.Items) != 2 || p1.NextCursor == "" {
		t.Fatalf("first search page invalid: %+v", p1)
	}
	p2, err := s.SearchMailbox(ctx, "bob.420", SearchRequest{Query: "searchable", Cursor: p1.NextCursor, Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(p2.Items) != 1 || p2.NextCursor != "" {
		t.Fatalf("second search page invalid: %+v", p2)
	}
}
