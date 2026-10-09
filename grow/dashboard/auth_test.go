package dashboard

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPrivateSessionRequiresTLSAndConfiguredDatabase(t *testing.T) {
	auth := SQLAuthenticator{}
	r := httptest.NewRequest(http.MethodGet, "https://grow.example/v1/private/session", nil)
	r.AddCookie(&http.Cookie{Name: CookieName, Value: "11111111-1111-4111-8111-111111111111.22222222-2222-4222-8222-222222222222.abcdef"})
	if _, err := auth.Verify(r); err == nil {
		t.Fatal("missing private database must reject session")
	}
	r.TLS = nil
	if _, err := auth.Verify(r); err == nil {
		t.Fatal("non TLS request must reject session")
	}
	if _, err := auth.Issue(r.Context(), "", "", "", time.Now(), nil); err == nil {
		t.Fatal("unauthenticated issuance accepted")
	}
}
