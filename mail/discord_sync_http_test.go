package mail

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func discordSyncHTTPHandler(t *testing.T, authority *discordFullAuthorityStub) HTTPHandler {
	t.Helper()
	store := NewMemoryStore()
	mailSvc := NewService(testIDs{"alice.420": true}, testPolicy{}, &testBlobs{}, &testNotify{}, store)
	connectors, err := NewDiscordConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	return HTTPHandler{
		Service:     mailSvc,
		Connectors:  connectors,
		DiscordSync: NewDiscordSyncService(connectors, mailSvc),
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
}

func TestHTTPDiscordSyncMaterializesInbox(t *testing.T) {
	authority := &discordFullAuthorityStub{
		page: DiscordSyncPage{Messages: []DiscordInboundMessage{validDiscordInboundMessage()}, NextCursor: "cursor-1"},
	}
	h := discordSyncHTTPHandler(t, authority)
	raw, _ := json.Marshal(map[string]string{"connection_id": "discord:123456789012345678"})
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/discord/sync", bytes.NewReader(raw))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out DiscordSyncResult
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Imported) != 1 || out.NextCursor != "cursor-1" {
		t.Fatalf("unexpected result: %+v", out)
	}
}

func TestHTTPDiscordSyncRequiresMailAuthentication(t *testing.T) {
	authority := &discordFullAuthorityStub{}
	h := discordSyncHTTPHandler(t, authority)
	raw, _ := json.Marshal(map[string]string{"connection_id": "discord:123456789012345678"})
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/discord/sync", bytes.NewReader(raw))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if len(authority.pulls) != 0 {
		t.Fatalf("unauthenticated sync reached Discord authority: %+v", authority.pulls)
	}
}

func TestHTTPDiscordSyncRejectsUnknownFields(t *testing.T) {
	authority := &discordFullAuthorityStub{}
	h := discordSyncHTTPHandler(t, authority)
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/discord/sync",
		bytes.NewBufferString(`{"connection_id":"discord:123456789012345678","access_token":"secret"}`))
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

func TestHTTPDiscordSyncRejectsWrongMethod(t *testing.T) {
	authority := &discordFullAuthorityStub{}
	h := discordSyncHTTPHandler(t, authority)
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/discord/sync", nil)
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPDiscordSyncMapsConflict(t *testing.T) {
	msg := validDiscordInboundMessage()
	authority := &discordFullAuthorityStub{page: DiscordSyncPage{Messages: []DiscordInboundMessage{msg}}}
	h := discordSyncHTTPHandler(t, authority)

	call := func() *httptest.ResponseRecorder {
		raw, _ := json.Marshal(map[string]string{"connection_id": "discord:123456789012345678"})
		req := httptest.NewRequest(http.MethodPost, "/v1/connectors/discord/sync", bytes.NewReader(raw))
		req.Header.Set("X-Test-Actor", "alice.420")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	if rec := call(); rec.Code != http.StatusOK {
		t.Fatalf("first status=%d body=%s", rec.Code, rec.Body.String())
	}
	msg.Content = "mutated"
	authority.page = DiscordSyncPage{Messages: []DiscordInboundMessage{msg}}
	rec := call()
	if rec.Code != http.StatusConflict {
		t.Fatalf("conflict status=%d body=%s", rec.Code, rec.Body.String())
	}
}
