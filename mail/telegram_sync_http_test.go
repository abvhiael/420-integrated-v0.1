package mail

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func telegramSyncHTTPHandler(t *testing.T, authority *telegramFullAuthorityStub) HTTPHandler {
	t.Helper()
	store := NewMemoryStore()
	mailSvc := NewService(testIDs{"alice.420": true}, testPolicy{}, &testBlobs{}, &testNotify{}, store)
	connectors, err := NewTelegramConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	return HTTPHandler{
		Service:      mailSvc,
		Connectors:   connectors,
		TelegramSync: NewTelegramSyncService(connectors, mailSvc),
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
}

func TestHTTPTelegramSyncMaterializesInbox(t *testing.T) {
	authority := &telegramFullAuthorityStub{
		page: TelegramSyncPage{Messages: []TelegramInboundMessage{validTelegramInboundMessage()}, NextCursor: "cursor-1"},
	}
	h := telegramSyncHTTPHandler(t, authority)
	raw, _ := json.Marshal(map[string]string{"connection_id": "telegram:1234567890"})
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/telegram/sync", bytes.NewReader(raw))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out TelegramSyncResult
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Imported) != 1 || out.NextCursor != "cursor-1" {
		t.Fatalf("unexpected result: %+v", out)
	}
}

func TestHTTPTelegramSyncRequiresMailAuthentication(t *testing.T) {
	authority := &telegramFullAuthorityStub{}
	h := telegramSyncHTTPHandler(t, authority)
	raw, _ := json.Marshal(map[string]string{"connection_id": "telegram:1234567890"})
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/telegram/sync", bytes.NewReader(raw))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if len(authority.pulls) != 0 {
		t.Fatalf("unauthenticated sync reached Telegram authority: %+v", authority.pulls)
	}
}

func TestHTTPTelegramSyncRejectsUnknownFields(t *testing.T) {
	authority := &telegramFullAuthorityStub{}
	h := telegramSyncHTTPHandler(t, authority)
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/telegram/sync",
		bytes.NewBufferString(`{"connection_id":"telegram:1234567890","bot_token":"secret"}`))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if len(authority.pulls) != 0 {
		t.Fatalf("secret-bearing sync request reached authority: %+v", authority.pulls)
	}
}

func TestHTTPTelegramSyncRejectsWrongMethod(t *testing.T) {
	authority := &telegramFullAuthorityStub{}
	h := telegramSyncHTTPHandler(t, authority)
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/telegram/sync", nil)
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPTelegramSyncMapsConflict(t *testing.T) {
	msg := validTelegramInboundMessage()
	authority := &telegramFullAuthorityStub{page: TelegramSyncPage{Messages: []TelegramInboundMessage{msg}}}
	h := telegramSyncHTTPHandler(t, authority)

	call := func() *httptest.ResponseRecorder {
		raw, _ := json.Marshal(map[string]string{"connection_id": "telegram:1234567890"})
		req := httptest.NewRequest(http.MethodPost, "/v1/connectors/telegram/sync", bytes.NewReader(raw))
		req.Header.Set("X-Test-Actor", "alice.420")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	if rec := call(); rec.Code != http.StatusOK {
		t.Fatalf("first status=%d body=%s", rec.Code, rec.Body.String())
	}
	msg.Content = "mutated"
	authority.page = TelegramSyncPage{Messages: []TelegramInboundMessage{msg}}
	rec := call()
	if rec.Code != http.StatusConflict {
		t.Fatalf("conflict status=%d body=%s", rec.Code, rec.Body.String())
	}
}
