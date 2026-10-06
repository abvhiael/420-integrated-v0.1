package mail

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func seedIntegrationInbox(t *testing.T, store MailStore) {
	t.Helper()
	base := time.Unix(1700001000, 0).UTC()
	err := store.Update(context.Background(), func(data *storeData) error {
		msgs := []Message{
			{ID: "discord-1", Sender: "discord:1", Recipient: "alice.420", Subject: "Discord one", CreatedAt: base.Add(3 * time.Minute), UpdatedAt: base.Add(3 * time.Minute), Status: "DELIVERED", Visibility: "PRIVATE", Source: DiscordProvider, Version: 1},
			{ID: "telegram-1", Sender: "telegram:2", Recipient: "alice.420", Subject: "Telegram one", CreatedAt: base.Add(2 * time.Minute), UpdatedAt: base.Add(2 * time.Minute), Status: "DELIVERED", Visibility: "PRIVATE", Source: TelegramProvider, Version: 1},
			{ID: "native-1", Sender: "bob.420", Recipient: "alice.420", Subject: "Native", CreatedAt: base.Add(4 * time.Minute), UpdatedAt: base.Add(4 * time.Minute), Status: "DELIVERED", Visibility: "PRIVATE", Source: ServiceID, Version: 1},
			{ID: "discord-archive", Sender: "discord:3", Recipient: "alice.420", Subject: "Archived", CreatedAt: base.Add(5 * time.Minute), UpdatedAt: base.Add(5 * time.Minute), Status: "DELIVERED", Visibility: "PRIVATE", Source: DiscordProvider, Version: 1},
			{ID: "telegram-deleted", Sender: "telegram:4", Recipient: "alice.420", Subject: "Deleted", CreatedAt: base.Add(6 * time.Minute), UpdatedAt: base.Add(6 * time.Minute), Status: "DELIVERED", Visibility: "PRIVATE", Source: TelegramProvider, Version: 1},
			{ID: "discord-other", Sender: "discord:5", Recipient: "charlie.420", Subject: "Other user", CreatedAt: base.Add(7 * time.Minute), UpdatedAt: base.Add(7 * time.Minute), Status: "DELIVERED", Visibility: "PRIVATE", Source: DiscordProvider, Version: 1},
		}
		for _, msg := range msgs {
			data.Messages[msg.ID] = msg
		}
		readAt := base.Add(8 * time.Minute)
		deletedAt := base.Add(9 * time.Minute)
		data.Mailbox[mailboxKey("alice.420", "discord-1")] = MailboxState{MessageID: "discord-1", Owner: "alice.420", Folder: FolderInbox, ReadAt: &readAt, Starred: true, UpdatedAt: base.Add(8 * time.Minute), Version: 3}
		data.Mailbox[mailboxKey("alice.420", "telegram-1")] = MailboxState{MessageID: "telegram-1", Owner: "alice.420", Folder: FolderInbox, UpdatedAt: base.Add(2 * time.Minute), Version: 1}
		data.Mailbox[mailboxKey("alice.420", "native-1")] = MailboxState{MessageID: "native-1", Owner: "alice.420", Folder: FolderInbox, UpdatedAt: base.Add(4 * time.Minute), Version: 1}
		data.Mailbox[mailboxKey("alice.420", "discord-archive")] = MailboxState{MessageID: "discord-archive", Owner: "alice.420", Folder: FolderArchive, UpdatedAt: base.Add(5 * time.Minute), Version: 2}
		data.Mailbox[mailboxKey("alice.420", "telegram-deleted")] = MailboxState{MessageID: "telegram-deleted", Owner: "alice.420", Folder: FolderInbox, DeletedAt: &deletedAt, UpdatedAt: deletedAt, Version: 2}
		data.Mailbox[mailboxKey("charlie.420", "discord-other")] = MailboxState{MessageID: "discord-other", Owner: "charlie.420", Folder: FolderInbox, UpdatedAt: base.Add(7 * time.Minute), Version: 1}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestIntegrationsInboxUnifiesCanonicalInboxSources(t *testing.T) {
	store := NewMemoryStore()
	seedIntegrationInbox(t, store)
	svc := NewService(nil, nil, nil, nil, store)

	page, err := svc.IntegrationsInbox(context.Background(), "alice.420", "", 50)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 2 {
		t.Fatalf("expected 2 integration inbox items, got %+v", page.Items)
	}
	if page.Items[0].Message.ID != "discord-1" || page.Items[1].Message.ID != "telegram-1" {
		t.Fatalf("unexpected order/content: %+v", page.Items)
	}
	if page.Items[0].State.ReadAt == nil || !page.Items[0].State.Starred || page.Items[0].State.Version != 3 {
		t.Fatalf("canonical mailbox state was not preserved: %+v", page.Items[0].State)
	}
}

func TestIntegrationsInboxExcludesNativeArchivedDeletedAndForeignItems(t *testing.T) {
	store := NewMemoryStore()
	seedIntegrationInbox(t, store)
	svc := NewService(nil, nil, nil, nil, store)
	page, err := svc.IntegrationsInbox(context.Background(), "alice.420", "", 100)
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range page.Items {
		if item.Message.Source != DiscordProvider && item.Message.Source != TelegramProvider {
			t.Fatalf("non-integration item leaked: %+v", item)
		}
		if item.State.Folder != FolderInbox || item.State.DeletedAt != nil || item.State.Owner != "alice.420" {
			t.Fatalf("non-canonical inbox state leaked: %+v", item.State)
		}
	}
}

func TestIntegrationsInboxPaginationOccursAfterIntegrationFilter(t *testing.T) {
	store := NewMemoryStore()
	seedIntegrationInbox(t, store)
	svc := NewService(nil, nil, nil, nil, store)

	first, err := svc.IntegrationsInbox(context.Background(), "alice.420", "", 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Items) != 1 || first.Items[0].Message.ID != "discord-1" || first.NextCursor == "" {
		t.Fatalf("unexpected first page: %+v", first)
	}
	second, err := svc.IntegrationsInbox(context.Background(), "alice.420", first.NextCursor, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Items) != 1 || second.Items[0].Message.ID != "telegram-1" || second.NextCursor != "" {
		t.Fatalf("unexpected second page: %+v", second)
	}
}

func TestIntegrationsInboxRejectsUnauthorizedAndBadCursor(t *testing.T) {
	svc := NewService(nil, nil, nil, nil, NewMemoryStore())
	if _, err := svc.IntegrationsInbox(context.Background(), "", "", 50); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("unauthorized integrations inbox accepted: %v", err)
	}
	if _, err := svc.IntegrationsInbox(context.Background(), "alice.420", "not-a-cursor", 50); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad cursor accepted: %v", err)
	}
}

func TestIntegrationInboxSourcesAreExplicitAndBounded(t *testing.T) {
	for _, source := range []string{DiscordProvider, TelegramProvider, " DISCORD ", "telegram"} {
		if !isIntegrationInboxSource(source) {
			t.Fatalf("expected integration source rejected: %q", source)
		}
	}
	for _, source := range []string{ServiceID, SignalProvider, "", "smtp", "discord-webhook"} {
		if isIntegrationInboxSource(source) {
			t.Fatalf("unsupported/future integration source accepted: %q", source)
		}
	}
}


func TestHTTPIntegrationsInbox(t *testing.T) {
	store := NewMemoryStore()
	seedIntegrationInbox(t, store)
	h := HTTPHandler{
		Service: NewService(nil, nil, nil, nil, store),
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/integrations/inbox?limit=1", nil)
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out IntegrationsInboxPage
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Items) != 1 || out.Items[0].Message.ID != "discord-1" || out.NextCursor == "" {
		t.Fatalf("unexpected response: %+v", out)
	}
}

func TestHTTPIntegrationsInboxRequiresAuthentication(t *testing.T) {
	h := HTTPHandler{
		Service: NewService(nil, nil, nil, nil, NewMemoryStore()),
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/integrations/inbox", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPIntegrationsInboxDoesNotExposeSourceFilterYet(t *testing.T) {
	store := NewMemoryStore()
	seedIntegrationInbox(t, store)
	h := HTTPHandler{
		Service: NewService(nil, nil, nil, nil, store),
		Authenticate: func(r *http.Request) (string, error) {
			return "alice.420", nil
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/integrations/inbox?source=discord", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out IntegrationsInboxPage
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Items) != 2 {
		t.Fatalf("MAIL-2.28 source filtering was pulled forward: %+v", out.Items)
	}
}
