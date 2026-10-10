package dashboard

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type denialAuth struct {
	session Session
	err     error
}

func (a denialAuth) Verify(*http.Request) (Session, error) { return a.session, a.err }

type denialReader struct {
	records []Item
	err     error
}

func (a denialReader) List(*http.Request, Session, string) ([]Item, error) { return a.records, a.err }

func TestV214FailClosedPrivateRoutes(t *testing.T) {
	active := Session{TenantID: "a", SubjectID: "u", Sections: []string{"plants"}, Actions: []string{"plants.create"}, ExpiresAt: time.Now().Add(time.Hour)}
	for _, scenario := range []struct {
		name   string
		auth   Authenticator
		reader Reader
		want   int
	}{
		{"missing authority", nil, denialReader{}, 503},
		{"missing DB", denialAuth{session: active}, nil, 503},
		{"unauthenticated", denialAuth{err: errors.New("bad cookie")}, denialReader{}, 401},
		{"expired", denialAuth{session: Session{TenantID: "a", SubjectID: "u", ExpiresAt: time.Now().Add(-time.Second)}}, denialReader{}, 401},
		{"DB outage", denialAuth{session: active}, denialReader{err: errors.New("connection dropped")}, 503},
		{"cross-tenant", denialAuth{session: active}, denialReader{records: []Item{{ID: "1", TenantID: "b", Title: "private"}}}, 503},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			srv := PrivateServer{Handler: Handler{Auth: scenario.auth, Reader: scenario.reader}}
			req := httptest.NewRequest("GET", "https://grow.example/v1/private/dashboard/plants", nil)
			w := httptest.NewRecorder()
			srv.ServeHTTP(w, req)
			if w.Code != scenario.want {
				t.Fatalf("status: %d, want %d", w.Code, scenario.want)
			}
			if !strings.Contains(w.Header().Get("Cache-Control"), "no-store") {
				t.Fatal("private error response cacheable")
			}
			if strings.Contains(w.Body.String(), "private") && strings.Contains(w.Body.String(), "Title") {
				t.Fatal("sensitive data in error")
			}
		})
	}
}

func TestV214CSRFSpoofingMethodAndOriginBoundaries(t *testing.T) {
	session := Session{TenantID: "a", SubjectID: "u", Sections: []string{"plants"}, Actions: []string{"plants.create"}, ExpiresAt: time.Now().Add(time.Hour)}
	srv := PrivateServer{Handler: Handler{Auth: denialAuth{session: session}, Reader: denialReader{}}}
	for _, attempt := range []struct{ method, origin, token string }{
		{"POST", "https://evil.example", "correct"},
		{"POST", "null", "correct"},
		{"POST", "https://grow.example", "corrupt"},
		{"POST", "https://grow.example", "missing"},
		{"GET", "https://grow.example", "correct"},
	} {
		req := httptest.NewRequest(attempt.method, "https://grow.example/v1/private/action/plants", strings.NewReader(`{"operation":"create"}`))
		req.Header.Set("Origin", attempt.origin)
		cookie := &http.Cookie{Name: CookieName, Value: "a.session.unforgeable"}
		req.AddCookie(cookie)
		if attempt.token == "correct" {
			req.Header.Set("X-CSRF-Token", csrfToken(cookie.Value))
		}
		if attempt.token == "corrupt" {
			req.Header.Set("X-CSRF-Token", strings.Repeat("0", 64))
		}
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, req)
		if w.Code != 403 {
			t.Errorf("%s %s %s returned %d (want 403)", attempt.method, attempt.origin, attempt.token, w.Code)
		}
	}
	for _, url := range []string{"/v1/private/action/../../plants", "/v1/private/action/__proto__", "/v1/private/action/plants/extra"} {
		req := httptest.NewRequest("GET", "https://grow.example"+url, nil)
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, req)
		if w.Code == 200 {
			t.Fatalf("unsupported path permitted: %s", url)
		}
	}
}
