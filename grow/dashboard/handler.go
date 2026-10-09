package dashboard

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type Session struct {
	TenantID  string
	SubjectID string
	Sections  []string
	Actions   []string
	ExpiresAt time.Time
}

type Item struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Summary  string `json:"summary"`
	State    string `json:"state,omitempty"`
	TenantID string `json:"tenantId"`
}

type Authenticator interface {
	Verify(*http.Request) (Session, error)
}

type Reader interface {
	List(*http.Request, Session, string) ([]Item, error)
}

type Handler struct {
	Auth   Authenticator
	Reader Reader
}

var known = map[string]bool{
	"overview": true, "facilities": true, "plants": true,
	"environment": true, "equipment": true, "cultivation": true,
	"harvests": true, "inventory": true, "advice": true,
	"notifications": true,
}

func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store, private")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.Auth == nil || h.Reader == nil {
		http.Error(w, "private dashboard unavailable", http.StatusServiceUnavailable)
		return
	}
	session, err := h.Auth.Verify(r)
	if err != nil || session.TenantID == "" || session.SubjectID == "" || !session.ExpiresAt.After(time.Now()) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	path := r.URL.Path
	if path == "/v1/private/session" {
		sections := make([]string, 0, len(session.Sections))
		used := map[string]bool{}
		for _, section := range session.Sections {
			if !known[section] || used[section] {
				http.Error(w, "invalid session", http.StatusForbidden)
				return
			}
			used[section] = true
			sections = append(sections, section)
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(struct {
			Version       string   `json:"version"`
			Authenticated bool     `json:"authenticated"`
			TenantID      string   `json:"tenantId"`
			SubjectID     string   `json:"subjectId"`
			Sections      []string `json:"sections"`
			ExpiresAt     string   `json:"expiresAt"`
		}{"grow-private-v1", true, session.TenantID, session.SubjectID, sections, session.ExpiresAt.UTC().Format(time.RFC3339Nano)})
		return
	}
	const prefix = "/v1/private/dashboard/"
	if !strings.HasPrefix(path, prefix) {
		http.NotFound(w, r)
		return
	}
	section := strings.TrimPrefix(path, prefix)
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
	records, err := h.Reader.List(r, session, section)
	if err != nil {
		http.Error(w, "private data unavailable", http.StatusServiceUnavailable)
		return
	}
	if len(records) > 500 {
		http.Error(w, "private result too large", http.StatusServiceUnavailable)
		return
	}
	found := map[string]bool{}
	for _, item := range records {
		if item.TenantID != session.TenantID || item.ID == "" || found[item.ID] || len(item.Title) > 160 || len(item.Summary) > 1000 {
			http.Error(w, "private projection rejected", http.StatusServiceUnavailable)
			return
		}
		found[item.ID] = true
	}
	if records == nil {
		records = []Item{}
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(struct {
		Version  string `json:"version"`
		TenantID string `json:"tenantId"`
		Section  string `json:"section"`
		Items    []Item `json:"items"`
	}{"grow-private-v1", session.TenantID, section, records})
}
