package dashboard

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type ActionResult struct {
	CSV      []byte
	Filename string
}

type Actions interface {
	Execute(*http.Request, Session, string, json.RawMessage) (ActionResult, error)
}

type PrivateServer struct {
	Handler Handler
	Actions Actions
	Revoke  func(*http.Request, Session) error
	Login   func(http.ResponseWriter, *http.Request) error
}

// CSRF tokens bind state-changing requests to the unreadable, Host-only session
// cookie. Both the Origin and token must be valid; remote redirects are rejected.
func csrfToken(cookieValue string) string {
	digest := sha256.Sum256([]byte("420grow-private-csrf-v1:" + cookieValue))
	return hex.EncodeToString(digest[:])
}
func verifyCSRF(r *http.Request) bool {
	if r.TLS == nil || r.Host == "" || r.Header.Get("Origin") != "https://"+r.Host {
		return false
	}
	cookie, err := r.Cookie(CookieName)
	if err != nil {
		return false
	}
	header, err := hex.DecodeString(r.Header.Get("X-CSRF-Token"))
	if err != nil || len(header) != 32 {
		return false
	}
	want, _ := hex.DecodeString(csrfToken(cookie.Value))
	return subtle.ConstantTimeCompare(header, want) == 1
}
func (s PrivateServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store, private")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if r.URL.Path == "/v1/private/login" {
		if r.Method != "POST" || r.TLS == nil || r.Header.Get("Origin") != "https://"+r.Host {
			http.Error(w, "private login forbidden", http.StatusForbidden)
			return
		}
		if s.Login == nil {
			http.Error(w, "login unavailable", http.StatusServiceUnavailable)
			return
		}
		if err := s.Login(w, r); err != nil {
			http.Error(w, "verified certificate or active membership required", http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.URL.Path == "/v1/private/logout" {
		if r.Method != "POST" || !verifyCSRF(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if s.Handler.Auth == nil || s.Revoke == nil {
			http.Error(w, "private service unavailable", http.StatusServiceUnavailable)
			return
		}
		session, err := s.Handler.Auth.Verify(r)
		if err != nil || session.SubjectID == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if err = s.Revoke(r, session); err != nil {
			http.Error(w, "logout unavailable", http.StatusServiceUnavailable)
			return
		}
		http.SetCookie(w, &http.Cookie{Name: CookieName, Value: "", Path: "/", MaxAge: -1, Expires: time.Unix(0, 0), Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode})
		w.WriteHeader(http.StatusNoContent)
		return
	}
	const prefix = "/v1/private/action/"
	if strings.HasPrefix(r.URL.Path, prefix) {
		if r.Method != "POST" || !verifyCSRF(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if s.Handler.Auth == nil || s.Actions == nil {
			http.Error(w, "private action service unavailable", http.StatusServiceUnavailable)
			return
		}
		session, err := s.Handler.Auth.Verify(r)
		if err != nil || session.SubjectID == "" || !session.ExpiresAt.After(time.Now()) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		section := strings.TrimPrefix(r.URL.Path, prefix)
		if !known[section] {
			http.NotFound(w, r)
			return
		}
		authorized := false
		for _, s := range session.Sections {
			if s == section {
				authorized = true
				break
			}
		}
		if !authorized {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 8192)
		var body json.RawMessage
		if err = json.NewDecoder(r.Body).Decode(&body); err != nil || len(body) == 0 {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		var request struct {
			Operation string `json:"operation"`
		}
		if json.Unmarshal(body, &request) != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		if request.Operation == "" {
			http.Error(w, "invalid operation", http.StatusBadRequest)
			return
		}
		allowedAction := false
		for _, v := range session.Actions {
			if v == section+"."+request.Operation {
				allowedAction = true
				break
			}
		}
		if !allowedAction {
			http.Error(w, "action not authorized", http.StatusForbidden)
			return
		}
		result, err := s.Actions.Execute(r, session, section, body)
		if err != nil {
			http.Error(w, "action unavailable or denied", http.StatusForbidden)
			return
		}
		if len(result.CSV) > 0 {
			if len(result.CSV) > 1048576 || !strings.HasSuffix(result.Filename, ".csv") {
				http.Error(w, "invalid export", http.StatusServiceUnavailable)
				return
			}
			w.Header().Set("Content-Type", "text/csv; charset=utf-8")
			w.Header().Set("Content-Disposition", "attachment; filename=\"grow-inventory.csv\"")
			_, _ = w.Write(result.CSV)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.URL.Path == "/v1/private/session" && r.Method == "GET" {
		// The session service's JSON contract is preserved, with a derived
		// CSRF proof readable only to the already authenticated same-origin page.
		if s.Handler.Auth == nil {
			http.Error(w, "unavailable", 503)
			return
		}
		session, err := s.Handler.Auth.Verify(r)
		if err != nil {
			http.Error(w, "unauthorized", 401)
			return
		}
		cookie, err := r.Cookie(CookieName)
		if err != nil {
			http.Error(w, "unauthorized", 401)
			return
		}
		sections := make([]string, 0, len(session.Sections))
		seen := map[string]bool{}
		for _, v := range session.Sections {
			if !known[v] || seen[v] {
				http.Error(w, "invalid session", 403)
				return
			}
			seen[v] = true
			sections = append(sections, v)
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{"version": "grow-private-v1", "authenticated": true, "tenantId": session.TenantID, "subjectId": session.SubjectID, "sections": sections, "expiresAt": session.ExpiresAt.UTC().Format(time.RFC3339Nano), "csrf": csrfToken(cookie.Value), "actions": session.Actions})
		return
	}
	s.Handler.ServeHTTP(w, r)
}
