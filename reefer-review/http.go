package reeferreview

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

type HTTP struct {
	Service Service
	News    *NewsService
}

func (h HTTP) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", h.ready)
	mux.HandleFunc("/v1/publications", h.publications)
	mux.HandleFunc("/v1/publications/", h.publication)
	mux.HandleFunc("/v1/news", h.news)
	mux.HandleFunc("/v1/news/sources", h.newsSources)
	mux.HandleFunc("/v1/news/topics", h.newsTopics)
	mux.HandleFunc("/v1/news/", h.newsItem)
	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func actor(r *http.Request) string { return strings.TrimSpace(r.Header.Get("X-420-Actor")) }
func (h HTTP) ready(w http.ResponseWriter, r *http.Request) {
	if err := h.Service.validate(); err != nil {
		writeJSON(w, 503, map[string]string{"status": "not_ready", "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]string{"status": "ready", "service": ServiceID})
}

func (h HTTP) publications(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var req CreateDraftRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
			writeJSON(w, 400, map[string]string{"error": "BAD_JSON"})
			return
		}
		p, err := h.Service.CreateDraft(r.Context(), actor(r), req)
		h.respond(w, p, nil, err)
	case http.MethodGet:
		limit := 20
		if v := r.URL.Query().Get("limit"); v != "" {
			n, e := strconv.Atoi(v)
			if e != nil {
				writeJSON(w, 400, map[string]string{"error": "BAD_LIMIT"})
				return
			}
			limit = n
		}
		offset := 0
		if c := r.URL.Query().Get("cursor"); c != "" {
			b, e := base64.RawURLEncoding.DecodeString(c)
			if e != nil {
				writeJSON(w, 400, map[string]string{"error": "BAD_CURSOR"})
				return
			}
			n, e := strconv.Atoi(string(b))
			if e != nil {
				writeJSON(w, 400, map[string]string{"error": "BAD_CURSOR"})
				return
			}
			offset = n
		}
		rows, total, err := h.Service.List(r.Context(), offset, limit)
		if err != nil {
			h.respond(w, nil, nil, err)
			return
		}
		next := ""
		if offset+len(rows) < total {
			next = base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset + len(rows))))
		}
		writeJSON(w, 200, map[string]any{"items": rows, "next_cursor": next})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h HTTP) publication(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/v1/publications/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 1 || parts[0] == "" {
		writeJSON(w, 404, map[string]string{"error": "NOT_FOUND"})
		return
	}
	id := parts[0]
	if len(parts) == 1 && r.Method == http.MethodGet {
		p, b, err := h.Service.GetPublic(r.Context(), id)
		if err != nil {
			h.respond(w, nil, nil, err)
			return
		}
		writeJSON(w, 200, map[string]any{"publication": p, "body": string(b)})
		return
	}
	if len(parts) == 2 && parts[1] == "publish" && r.Method == http.MethodPost {
		p, warns, err := h.Service.Publish(r.Context(), actor(r), id)
		h.respond(w, p, warns, err)
		return
	}
	if len(parts) == 2 && parts[1] == "moderate" && r.Method == http.MethodPost {
		var req ModerateRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&req); err != nil {
			writeJSON(w, 400, map[string]string{"error": "BAD_JSON"})
			return
		}
		p, err := h.Service.Moderate(r.Context(), actor(r), id, req.Action)
		h.respond(w, p, nil, err)
		return
	}
	w.WriteHeader(http.StatusMethodNotAllowed)
}

func (h HTTP) respond(w http.ResponseWriter, v any, warns []string, err error) {
	if err == nil {
		writeJSON(w, 200, map[string]any{"data": v, "warnings": warns})
		return
	}
	switch {
	case errors.Is(err, ErrInvalidInput):
		writeJSON(w, 400, map[string]string{"error": "INVALID_INPUT"})
	case errors.Is(err, ErrUnauthorized):
		writeJSON(w, 403, map[string]string{"error": "UNAUTHORIZED"})
	case errors.Is(err, ErrNotFound):
		writeJSON(w, 404, map[string]string{"error": "NOT_FOUND"})
	case errors.Is(err, ErrConflict):
		writeJSON(w, 409, map[string]string{"error": "CONFLICT"})
	default:
		writeJSON(w, 500, map[string]string{"error": "INTERNAL"})
	}
}
