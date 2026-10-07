package reeferreview

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
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
	mux.HandleFunc("/v1/editorial/publications", h.editorialPublications)
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
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": ServiceID})
}

func parsePage(r *http.Request) (int, int, error) {
	limit := 20
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return 0, 0, ErrInvalidInput
		}
		limit = n
	}
	offset := 0
	if c := r.URL.Query().Get("cursor"); c != "" {
		b, err := base64.RawURLEncoding.DecodeString(c)
		if err != nil {
			return 0, 0, ErrInvalidInput
		}
		n, err := strconv.Atoi(string(b))
		if err != nil {
			return 0, 0, ErrInvalidInput
		}
		offset = n
	}
	return offset, limit, nil
}

func pageCursor(offset, count, total int) string {
	if offset+count >= total {
		return ""
	}
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset + count)))
}

func (h HTTP) publications(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var req CreateDraftRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "BAD_JSON"})
			return
		}
		p, err := h.Service.CreateDraft(r.Context(), actor(r), req)
		h.respond(w, p, nil, err)
	case http.MethodGet:
		offset, limit, err := parsePage(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "BAD_CURSOR_OR_LIMIT"})
			return
		}
		rows, total, err := h.Service.List(r.Context(), offset, limit)
		if err != nil {
			h.respond(w, nil, nil, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": rows, "next_cursor": pageCursor(offset, len(rows), total)})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h HTTP) editorialPublications(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	offset, limit, err := parsePage(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "BAD_CURSOR_OR_LIMIT"})
		return
	}
	rows, total, err := h.Service.ListEditorial(r.Context(), actor(r), offset, limit)
	if err != nil {
		h.respond(w, nil, nil, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": rows, "next_cursor": pageCursor(offset, len(rows), total)})
}

func (h HTTP) publication(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/v1/publications/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 1 || parts[0] == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "NOT_FOUND"})
		return
	}
	id := parts[0]

	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			p, b, err := h.Service.GetForActor(r.Context(), actor(r), id)
			if err != nil {
				h.respond(w, nil, nil, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"publication": p, "body": string(b)})
			return
		case http.MethodPut:
			var req UpdatePublicationRequest
			if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "BAD_JSON"})
				return
			}
			p, warnings, err := h.Service.Update(r.Context(), actor(r), id, req)
			h.respond(w, p, warnings, err)
			return
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
	}

	if len(parts) != 2 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "NOT_FOUND"})
		return
	}

	switch parts[1] {
	case "publish":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		p, warnings, err := h.Service.Publish(r.Context(), actor(r), id)
		h.respond(w, p, warnings, err)
	case "moderate":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req ModerateRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "BAD_JSON"})
			return
		}
		p, event, err := h.Service.Moderate(r.Context(), actor(r), id, req.Action, req.Reason)
		if err != nil {
			h.respond(w, nil, nil, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"data": p, "moderation_event": event, "warnings": []string{}})
	case "tombstone":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req TombstoneRequest
		if r.Body != nil {
			if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "BAD_JSON"})
				return
			}
		}
		p, event, err := h.Service.Tombstone(r.Context(), actor(r), id, req.Reason)
		if err != nil {
			h.respond(w, nil, nil, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"data": p, "moderation_event": event, "warnings": []string{}})
	case "revisions":
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		rows, err := h.Service.ListRevisions(r.Context(), actor(r), id)
		if err != nil {
			h.respond(w, nil, nil, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": rows})
	case "moderation":
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		rows, err := h.Service.ListModerationHistory(r.Context(), actor(r), id)
		if err != nil {
			h.respond(w, nil, nil, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": rows})
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "NOT_FOUND"})
	}
}

func (h HTTP) respond(w http.ResponseWriter, v any, warns []string, err error) {
	if err == nil {
		writeJSON(w, http.StatusOK, map[string]any{"data": v, "warnings": warns})
		return
	}
	switch {
	case errors.Is(err, ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "INVALID_INPUT"})
	case errors.Is(err, ErrUnauthorized):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "UNAUTHORIZED"})
	case errors.Is(err, ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "NOT_FOUND"})
	case errors.Is(err, ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "CONFLICT"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "INTERNAL"})
	}
}
