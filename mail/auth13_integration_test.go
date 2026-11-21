package mail

import (
	"bytes"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	gateway "github.com/420integrated/420-integrated/services/420id/app-gateway"
)

func TestAUTH13MailWalletFreeSurfaceWhitelistAndLegacyAuthority(t *testing.T) {
	allowed := []struct{ method, path string }{
		{"GET", "/v1/inbox"}, {"POST", "/v1/messages"},
	}
	for _, v := range allowed {
		r := httptest.NewRequest(v.method, "https://420mail.420integrated.org"+v.path, nil)
		if !allow420IDMailbox(r) {
			t.Fatalf("expected personal mailbox allowed: %s %s", v.method, v.path)
		}
	}
	excluded := []struct{ method, path string }{
		{"POST", "/v1/wallet/actions"}, {"GET", "/v1/wallet/verifications"},
		{"POST", "/v1/connectors/link"}, {"GET", "/v1/integrations/identity"},
		{"POST", "/v1/security/revoke"}, {"GET", "/v1/search"},
		{"POST", "/v1/messages/other"}, {"DELETE", "/v1/inbox"},
		{"GET", "/v1/onboarding/status"}, {"GET", "/v1/trust/entries"},
	}
	for _, v := range excluded {
		req := httptest.NewRequest(v.method, "https://420mail.420integrated.org"+v.path, nil)
		if allow420IDMailbox(req) {
			t.Fatalf("unauthorized scope inherited from 420ID: %s %s", v.method, v.path)
		}
	}
	var h HTTPHandler
	if e := h.Enable420ID(nil); e == nil {
		t.Fatal("nil app gateway accepted")
	}
	db := &sql.DB{}
	makeGateway := func(app string) *gateway.Gateway {
		x, e := gateway.New(gateway.Config{AppID: app, DB: db,
			ClientSecret: bytes.Repeat([]byte{21}, 32), SessionKey: bytes.Repeat([]byte{43}, 32),
			TrustedTLSProxy: true})
		if e != nil {
			t.Fatal(e)
		}
		return x
	}
	if e := h.Enable420ID(makeGateway("420pay")); e == nil {
		t.Fatal("financial app may control mail identity")
	}
	if e := h.Enable420ID(makeGateway("420mail")); e != nil {
		t.Fatal("approved mail gateway rejected", e)
	}
	// Legacy bearer sessions are never overridden by cookie fallback even where
	// the specified operation would otherwise allow optional 420ID auth.
	h.Authenticate = func(r *http.Request) (string, error) { return "legacy-account", nil }
	req := httptest.NewRequest("GET", "https://420mail.420integrated.org/v1/inbox", nil)
	req.Header.Set("Authorization", "Bearer valid")
	w := httptest.NewRecorder()
	// An absent service must remain unavailable even after attaching 420ID.
	h.ServeHTTP(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatal("420ID bypassed original service readiness", w.Code)
	}
}
