package reeferreview

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
)

type HTTP struct {
	Service  Service
	News     *NewsService
	Security *SessionSecurity
	NewsAdminKey []byte
}

func (h HTTP) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", h.ready)
	mux.HandleFunc("/v1/publications", h.publications)
	mux.HandleFunc("/v1/publications/", h.publication)
	mux.HandleFunc("/v1/editorial/publications", h.editorialPublications)
	mux.HandleFunc("/v1/news", h.news)
	mux.HandleFunc("/v1/news/sources", h.newsSources)
	mux.HandleFunc("/v1/admin/news/sources", h.newsAdminSources)
	mux.HandleFunc("/v1/news/topics", h.newsTopics)
	mux.HandleFunc("/v1/news/", h.newsItem)
	return securityResponseHeaders((&HTTPMetrics{}).Middleware(newAPIRateLimiter(120, 1, 4096).wrap(h.sessionMiddleware(mux))))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func actorFromContext(ctx context.Context) string {
	claims, ok := authenticatedSession(ctx)
	if !ok {
		return ""
	}
	return claims.Subject
}

func bearerToken(header string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	token := strings.TrimSpace(strings.TrimPrefix(header, prefix))
	if token == "" || strings.ContainsAny(token, " \t\r\n,") {
		return ""
	}
	return token
}

func sessionRequirements(method, path string) ([]string, bool) {
	if path == "/v1/admin/news/sources" && (method == http.MethodGet || method == http.MethodPost || method == http.MethodPut) {
		return []string{CapabilityModerator}, true
	}
	if method == http.MethodPost && path == "/v1/publications" {
		return []string{CapabilityAuthor, CapabilityPublisher}, true
	}
	if method == http.MethodGet && path == "/v1/editorial/publications" {
		return []string{CapabilityAuthor, CapabilityPublisher, CapabilityModerator}, true
	}
	if strings.HasPrefix(path, "/v1/publications/") {
		if method == http.MethodPut {
			return []string{CapabilityAuthor, CapabilityPublisher}, true
		}
		switch {
		case method == http.MethodPost && strings.HasSuffix(path, "/publish"):
			return []string{CapabilityAuthor, CapabilityPublisher}, true
		case method == http.MethodPost && strings.HasSuffix(path, "/moderate"):
			return []string{CapabilityModerator, CapabilityPublisher}, true
		case method == http.MethodPost && strings.HasSuffix(path, "/tombstone"):
			return []string{CapabilityAuthor, CapabilityPublisher}, true
		case method == http.MethodGet && strings.HasSuffix(path, "/revisions"):
			return []string{CapabilityAuthor, CapabilityPublisher, CapabilityModerator}, true
		case method == http.MethodGet && strings.HasSuffix(path, "/moderation"):
			return []string{CapabilityAuthor, CapabilityPublisher, CapabilityModerator}, true
		}
	}
	return nil, false
}

func (h HTTP) sessionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		required, protected := sessionRequirements(r.Method, r.URL.Path)
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		if !protected && header == "" {
			next.ServeHTTP(w, r)
			return
		}
		if h.Security == nil {
			if protected {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "SESSION_VERIFIER_UNAVAILABLE"})
				return
			}
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "INVALID_SESSION"})
			return
		}
		token := bearerToken(header)
		if token == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "SESSION_REQUIRED"})
			return
		}
		claims, err := h.Security.Verify(r.Context(), token)
		if err != nil {
			code := "INVALID_SESSION"
			switch {
			case errors.Is(err, ErrSessionExpired):
				code = "SESSION_EXPIRED"
			case errors.Is(err, ErrSessionRevoked):
				code = "SESSION_REVOKED"
			case errors.Is(err, ErrSessionScope):
				code = "SESSION_SCOPE"
			case errors.Is(err, ErrSessionRequired):
				code = "SESSION_REQUIRED"
			}
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": code})
			return
		}
		if protected && !HasAnyCapability(claims, required...) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "CAPABILITY_DENIED"})
			return
		}
		next.ServeHTTP(w, r.WithContext(withSessionClaims(r.Context(), claims)))
	})
}

func (h HTTP) ready(w http.ResponseWriter, r *http.Request) {
	if err := h.Service.validate(); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "error": err.Error()})
		return
	}
	if h.Security == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "error": "session verifier unavailable"})
		return
	}
	if err := h.Security.Validate(); err != nil {
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
		p, err := h.Service.CreateDraft(r.Context(), actorFromContext(r.Context()), req)
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
	rows, total, err := h.Service.ListEditorial(r.Context(), actorFromContext(r.Context()), offset, limit)
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
			p, b, err := h.Service.GetForActor(r.Context(), actorFromContext(r.Context()), id)
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
			p, warnings, err := h.Service.Update(r.Context(), actorFromContext(r.Context()), id, req)
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
		p, warnings, err := h.Service.Publish(r.Context(), actorFromContext(r.Context()), id)
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
		p, event, err := h.Service.Moderate(r.Context(), actorFromContext(r.Context()), id, req.Action, req.Reason)
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
		p, event, err := h.Service.Tombstone(r.Context(), actorFromContext(r.Context()), id, req.Reason)
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
		rows, err := h.Service.ListRevisions(r.Context(), actorFromContext(r.Context()), id)
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
		rows, err := h.Service.ListModerationHistory(r.Context(), actorFromContext(r.Context()), id)
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
