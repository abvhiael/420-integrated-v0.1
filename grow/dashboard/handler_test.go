package dashboard

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type fakeAuth struct {
	session Session
	err     error
}

func (a fakeAuth) Verify(*http.Request) (Session, error) {
	return a.session, a.err
}

type fakeReader struct {
	rows []Item
	err  error
}

func (s fakeReader) List(_ *http.Request, _ Session, _ string) ([]Item, error) {
	return s.rows, s.err
}

func TestDashboardRejectsAnonymousExpiredCrossTenantAndMissingBackend(t *testing.T) {
	session := Session{TenantID: "a", SubjectID: "u", Sections: []string{"plants"}, ExpiresAt: time.Now().Add(time.Hour)}
	good := func() Handler {
		return Handler{Auth: fakeAuth{session: session}, Reader: fakeReader{rows: []Item{{TenantID: "a", ID: "p", Title: "Plant", Summary: "Observed"}}}}
	}
	check := func(h Handler, path string, status int) {
		t.Helper()
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != status {
			t.Fatalf("%s got %d expected %d: %s", path, w.Code, status, w.Body.String())
		}
		if w.Header().Get("Cache-Control") != "no-store, private" {
			t.Fatal("private cache header missing")
		}
	}
	check(good(), "/v1/private/session", 200)
	check(good(), "/v1/private/dashboard/plants", 200)
	check(good(), "/v1/private/dashboard/inventory", 403)
	check(good(), "/v1/private/dashboard/bad", 404)
	check(Handler{}, "/v1/private/session", 503)
	h := good()
	h.Auth = fakeAuth{err: errors.New("bad")}
	check(h, "/v1/private/dashboard/plants", 401)
	h = good()
	session.ExpiresAt = time.Now().Add(-time.Hour)
	h.Auth = fakeAuth{session: session}
	check(h, "/v1/private/session", 401)
	session.ExpiresAt = time.Now().Add(time.Hour)
	h = good()
	h.Reader = fakeReader{rows: []Item{{TenantID: "b", ID: "p", Title: "Cross tenant"}}}
	check(h, "/v1/private/dashboard/plants", 503)
	h = good()
	h.Reader = fakeReader{err: errors.New("database offline")}
	check(h, "/v1/private/dashboard/plants", 503)
	h = good()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/v1/private/dashboard/plants", nil))
	if !strings.Contains(w.Body.String(), "\"tenantId\":\"a\"") {
		t.Fatal("tenant-scoped JSON missing")
	}
}
